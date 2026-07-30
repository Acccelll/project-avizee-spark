-- ============================================================================
-- Correção dos bugs bloqueantes do fluxo baixa → estorno → conciliação
--
-- Contexto: a migration 20260420182832 desenhou o estorno LÓGICO
-- (estornada_em/estornada_por/motivo_estorno + trigger de auditoria
-- 'estorno_baixa' + trg_sync_financeiro_saldo filtrando baixas ativas),
-- mas a RPC estornar_baixa_financeira nunca foi migrada e continuou
-- fazendo DELETE físico. Resultado: 0 eventos 'estorno_baixa' em
-- financeiro_auditoria contra 328 eventos 'baixa'.
--
-- Corrige:
--   1) caixa_movimentos sem vínculo com a baixa de origem
--   2) estornar_baixa_financeira: DELETE físico → estorno lógico
--   3) financeiro_processar_estorno: gravava status='estornado', proibido
--      pelo CHECK chk_financeiro_lancamentos_status desde 20/04/2026
--   4) editar_baixa_admin: INSERT em colunas inexistentes (data_pagamento,
--      usuario_id) e perda dos campos de conciliação
--   5) saldo_restante congelado quando financeiro_lancamentos.valor muda
-- ============================================================================


-- ============================================================
-- 1) VÍNCULO DA BAIXA COM O LEDGER DE CAIXA
-- ============================================================
-- registrar_baixa_financeira aceita p_skip_caixa (usado por
-- baixar_fatura_cartao, que lança um caixa consolidado por fatura em vez
-- de um por item). O estorno, porém, sempre lançava a contrapartida —
-- duplicando o ledger. Passamos a registrar explicitamente se a baixa
-- gerou movimento de caixa.

ALTER TABLE public.financeiro_baixas
  ADD COLUMN IF NOT EXISTS caixa_movimento_registrado boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.financeiro_baixas.caixa_movimento_registrado IS
  'Indica se esta baixa gerou movimento em caixa_movimentos. Falso quando a '
  'baixa faz parte de um lote com caixa consolidado (ex.: fatura de cartão). '
  'O estorno só lança contrapartida de caixa quando verdadeiro.';

ALTER TABLE public.caixa_movimentos
  ADD COLUMN IF NOT EXISTS baixa_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'caixa_movimentos_baixa_id_fkey'
  ) THEN
    ALTER TABLE public.caixa_movimentos
      ADD CONSTRAINT caixa_movimentos_baixa_id_fkey
      FOREIGN KEY (baixa_id) REFERENCES public.financeiro_baixas(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_caixa_movimentos_baixa
  ON public.caixa_movimentos (baixa_id) WHERE baixa_id IS NOT NULL;

-- Backfill: baixas pertencentes a lote de fatura de cartão foram criadas
-- com skip_caixa=true. Todas as demais geraram movimento.
UPDATE public.financeiro_baixas b
   SET caixa_movimento_registrado = false
  FROM public.financeiro_baixa_lotes lote
 WHERE lote.id = b.grupo_baixa_id
   AND lote.tipo = 'fatura_cartao';


-- ============================================================
-- 2) registrar_baixa_financeira — registra o vínculo com o caixa
-- ============================================================
CREATE OR REPLACE FUNCTION public.registrar_baixa_financeira(
  p_lancamento_id uuid,
  p_valor_pago numeric,
  p_data_baixa date,
  p_forma_pagamento text,
  p_conta_bancaria_id uuid,
  p_observacoes text DEFAULT NULL::text,
  p_desconto numeric DEFAULT 0,
  p_juros numeric DEFAULT 0,
  p_multa numeric DEFAULT 0,
  p_abatimento numeric DEFAULT 0,
  p_grupo_baixa_id uuid DEFAULT NULL::uuid,
  p_skip_caixa boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lanc record;
  v_baixa_id uuid;
  v_signal int;
  v_valor_movimento numeric;
  v_desc numeric := COALESCE(p_desconto,0);
  v_jur numeric := COALESCE(p_juros,0);
  v_mul numeric := COALESCE(p_multa,0);
  v_aba numeric := COALESCE(p_abatimento,0);
BEGIN
  IF p_valor_pago IS NULL OR p_valor_pago <= 0 THEN
    RAISE EXCEPTION 'Valor da baixa deve ser maior que zero';
  END IF;
  IF p_conta_bancaria_id IS NULL THEN
    RAISE EXCEPTION 'Conta bancária é obrigatória';
  END IF;

  -- Trava o lançamento contra baixas concorrentes
  PERFORM pg_advisory_xact_lock(hashtext('fin_baixa:' || p_lancamento_id::text));

  SELECT * INTO v_lanc FROM public.financeiro_lancamentos
   WHERE id = p_lancamento_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lançamento % não encontrado', p_lancamento_id;
  END IF;
  IF v_lanc.status IN ('cancelado','pago') THEN
    RAISE EXCEPTION 'Lançamento % está % e não aceita baixa', p_lancamento_id, v_lanc.status;
  END IF;
  IF p_valor_pago > COALESCE(v_lanc.saldo_restante, v_lanc.valor) + 0.009 THEN
    RAISE EXCEPTION 'Valor pago (%) excede saldo restante (%)', p_valor_pago, v_lanc.saldo_restante;
  END IF;

  v_valor_movimento := p_valor_pago - v_desc + v_jur + v_mul - v_aba;

  INSERT INTO public.financeiro_baixas
    (lancamento_id, data_baixa, valor_pago, forma_pagamento, conta_bancaria_id,
     observacoes, desconto, juros, multa, abatimento,
     valor_movimento_bancario, grupo_baixa_id, caixa_movimento_registrado)
  VALUES
    (p_lancamento_id, p_data_baixa, p_valor_pago, p_forma_pagamento, p_conta_bancaria_id,
     p_observacoes, v_desc, v_jur, v_mul, v_aba,
     v_valor_movimento, p_grupo_baixa_id, NOT COALESCE(p_skip_caixa, false))
  RETURNING id INTO v_baixa_id;

  v_signal := CASE WHEN v_lanc.tipo = 'receber' THEN 1 ELSE -1 END;
  UPDATE public.contas_bancarias
     SET saldo_atual = COALESCE(saldo_atual, 0) + (v_signal * v_valor_movimento),
         updated_at = now()
   WHERE id = p_conta_bancaria_id;

  IF NOT COALESCE(p_skip_caixa, false) THEN
    INSERT INTO public.caixa_movimentos
      (conta_bancaria_id, tipo, valor, descricao, forma_pagamento, saldo_atual, baixa_id)
    SELECT p_conta_bancaria_id,
           CASE WHEN v_lanc.tipo = 'receber' THEN 'entrada' ELSE 'saida' END,
           v_valor_movimento,
           'Baixa financeira: ' || COALESCE(v_lanc.descricao, v_lanc.id::text),
           p_forma_pagamento,
           (SELECT saldo_atual FROM public.contas_bancarias WHERE id = p_conta_bancaria_id),
           v_baixa_id;
  END IF;

  RETURN v_baixa_id;
END;
$function$;


-- ============================================================
-- 3) estornar_baixa_financeira — DELETE físico → estorno lógico
-- ============================================================
-- Passa a marcar estornada_em/estornada_por/motivo_estorno, o que:
--   • dispara trg_financeiro_auditoria_baixa (evento 'estorno_baixa')
--   • faz trg_sync_financeiro_saldo recalcular ignorando a baixa estornada
--   • preserva a trilha para conferência e reprocessamento
-- Além disso: idempotente, respeita caixa_movimento_registrado e
-- desconcilia/reabre a linha de extrato vinculada.
CREATE OR REPLACE FUNCTION public.estornar_baixa_financeira(
  p_baixa_id uuid,
  p_motivo text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_baixa record;
  v_lanc record;
  v_signal int;
  v_valor numeric;
BEGIN
  SELECT * INTO v_baixa FROM public.financeiro_baixas WHERE id = p_baixa_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Baixa % não encontrada', p_baixa_id;
  END IF;

  -- Idempotência: estornar duas vezes não pode dobrar o saldo bancário.
  IF v_baixa.estornada_em IS NOT NULL THEN
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('fin_baixa:' || v_baixa.lancamento_id::text));

  SELECT * INTO v_lanc FROM public.financeiro_lancamentos
   WHERE id = v_baixa.lancamento_id FOR UPDATE;

  v_valor := COALESCE(v_baixa.valor_movimento_bancario, v_baixa.valor_pago);

  IF v_baixa.conta_bancaria_id IS NOT NULL THEN
    v_signal := CASE WHEN v_lanc.tipo = 'receber' THEN -1 ELSE 1 END;
    UPDATE public.contas_bancarias
       SET saldo_atual = COALESCE(saldo_atual, 0) + (v_signal * v_valor),
           updated_at = now()
     WHERE id = v_baixa.conta_bancaria_id;

    -- Contrapartida no caixa apenas se a baixa original tiver lançado nele.
    IF COALESCE(v_baixa.caixa_movimento_registrado, true) THEN
      INSERT INTO public.caixa_movimentos
        (conta_bancaria_id, tipo, valor, descricao, forma_pagamento, saldo_atual, baixa_id)
      SELECT v_baixa.conta_bancaria_id,
             CASE WHEN v_lanc.tipo = 'receber' THEN 'saida' ELSE 'entrada' END,
             v_valor,
             'Estorno baixa: ' || COALESCE(p_motivo, v_lanc.descricao, v_lanc.id::text),
             v_baixa.forma_pagamento,
             (SELECT saldo_atual FROM public.contas_bancarias WHERE id = v_baixa.conta_bancaria_id),
             v_baixa.id;
    END IF;
  END IF;

  -- Estorno lógico. Dispara auditoria ('estorno_baixa') e ressincroniza o saldo.
  UPDATE public.financeiro_baixas
     SET estornada_em = now(),
         estornada_por = auth.uid(),
         motivo_estorno = COALESCE(p_motivo, motivo_estorno),
         conciliacao_status = CASE
           WHEN conciliacao_status = 'conciliado' THEN 'desconciliado'
           ELSE conciliacao_status
         END
   WHERE id = p_baixa_id;

  -- Reabre a linha de extrato que apontava para esta baixa, para que ela
  -- volte à fila de conciliação em vez de ficar órfã como 'conciliado'.
  UPDATE public.financeiro_extrato_importacoes
     SET status = 'pendente',
         baixa_id = NULL,
         updated_at = now()
   WHERE baixa_id = p_baixa_id;

  IF p_motivo IS NOT NULL THEN
    UPDATE public.financeiro_lancamentos
       SET motivo_estorno = p_motivo, updated_at = now()
     WHERE id = v_baixa.lancamento_id;
  END IF;
END;
$function$;


-- ============================================================
-- 4) financeiro_processar_estorno — RPC morta desde 20/04/2026
-- ============================================================
-- Gravava status='estornado', valor rejeitado por
-- chk_financeiro_lancamentos_status CHECK (status IN
-- ('aberto','parcial','pago','cancelado')). Toda chamada estourava 23514.
-- Também apagava as baixas sem reverter contas_bancarias.saldo_atual nem
-- lançar contrapartida no caixa — corromperia o saldo se tivesse rodado.
--
-- Nova versão: delega para estornar_baixa_financeira (que já reverte saldo,
-- caixa, auditoria e conciliação) e deixa o status ser derivado por
-- trg_sync_financeiro_saldo, sem escrever status inválido.
CREATE OR REPLACE FUNCTION public.financeiro_processar_estorno(
  p_lancamento_id uuid,
  p_motivo text DEFAULT 'Estorno manual'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lanc record;
  v_baixa record;
  v_qtd int := 0;
BEGIN
  SELECT * INTO v_lanc FROM public.financeiro_lancamentos
   WHERE id = p_lancamento_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lançamento não encontrado');
  END IF;

  IF v_lanc.status NOT IN ('pago', 'parcial') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Só é possível estornar lançamentos pago ou parcial. Status: '
               || COALESCE(v_lanc.status, 'null')
    );
  END IF;

  FOR v_baixa IN
    SELECT id FROM public.financeiro_baixas
     WHERE lancamento_id = p_lancamento_id
       AND estornada_em IS NULL
     ORDER BY created_at
  LOOP
    PERFORM public.estornar_baixa_financeira(v_baixa.id, p_motivo);
    v_qtd := v_qtd + 1;
  END LOOP;

  IF v_qtd = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Nenhuma baixa ativa encontrada para estornar.'
    );
  END IF;

  -- status/valor_pago/saldo_restante já foram recalculados por
  -- trg_sync_financeiro_saldo a cada estorno. Aqui só registramos o motivo.
  UPDATE public.financeiro_lancamentos
     SET motivo_estorno = p_motivo, updated_at = now()
   WHERE id = p_lancamento_id;

  RETURN jsonb_build_object(
    'success', true,
    'lancamento_id', p_lancamento_id,
    'baixas_estornadas', v_qtd
  );
END;
$function$;


-- ============================================================
-- 5) editar_baixa_admin — colunas inexistentes
-- ============================================================
-- Inseria em financeiro_baixas (data_pagamento, usuario_id): nenhuma das
-- duas existe (a coluna de data é data_baixa). Erro 42703 garantido.
-- Além disso descartava forma_pagamento, valor_movimento_bancario,
-- grupo_baixa_id e o bloco conciliacao_*, devolvendo a baixa editada
-- desconciliada e sem vínculo com o extrato.
CREATE OR REPLACE FUNCTION public.editar_baixa_admin(
  p_baixa_id uuid,
  p_payload jsonb,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_old public.financeiro_baixas%ROWTYPE;
  v_nova_id uuid;
  v_data_baixa date;
  v_valor_pago numeric;
  v_desconto numeric;
  v_juros numeric;
  v_multa numeric;
  v_abatimento numeric;
BEGIN
  IF v_uid IS NULL OR NOT public.can_edit_financeiro_avancado(v_uid) THEN
    RAISE EXCEPTION 'Apenas Admin ou Financeiro podem editar baixas' USING ERRCODE = '42501';
  END IF;
  IF coalesce(trim(p_motivo),'') = '' OR char_length(trim(p_motivo)) < 10 THEN
    RAISE EXCEPTION 'Informe o motivo da edicao (minimo 10 caracteres)' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_old FROM public.financeiro_baixas WHERE id = p_baixa_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Baixa % nao encontrada', p_baixa_id USING ERRCODE = 'P0002';
  END IF;
  IF v_old.estornada_em IS NOT NULL THEN
    RAISE EXCEPTION 'Baixa % já está estornada e não pode ser editada', p_baixa_id
      USING ERRCODE = '22023';
  END IF;

  -- 'data_pagamento' aceito como alias legado de 'data_baixa'.
  v_data_baixa := COALESCE(
    NULLIF(p_payload->>'data_baixa','')::date,
    NULLIF(p_payload->>'data_pagamento','')::date,
    v_old.data_baixa
  );
  v_valor_pago  := COALESCE((p_payload->>'valor_pago')::numeric,  v_old.valor_pago);
  v_desconto    := COALESCE((p_payload->>'desconto')::numeric,    v_old.desconto);
  v_juros       := COALESCE((p_payload->>'juros')::numeric,       v_old.juros);
  v_multa       := COALESCE((p_payload->>'multa')::numeric,       v_old.multa);
  v_abatimento  := COALESCE((p_payload->>'abatimento')::numeric,  v_old.abatimento);

  -- Estorna a baixa antiga (libera saldo do lancamento via trigger).
  PERFORM public.estornar_baixa_financeira(p_baixa_id, format('Edicao privilegiada: %s', p_motivo));

  -- Cria nova baixa com payload merged, preservando forma de pagamento,
  -- lote e vínculo de conciliação da baixa original.
  INSERT INTO public.financeiro_baixas (
    lancamento_id, valor_pago, data_baixa, conta_bancaria_id, forma_pagamento,
    desconto, juros, multa, abatimento, observacoes,
    valor_movimento_bancario, grupo_baixa_id, caixa_movimento_registrado,
    conciliacao_status, conciliacao_extrato_referencia,
    conciliacao_data, conciliacao_usuario
  ) VALUES (
    v_old.lancamento_id,
    v_valor_pago,
    v_data_baixa,
    COALESCE(NULLIF(p_payload->>'conta_bancaria_id','')::uuid, v_old.conta_bancaria_id),
    COALESCE(p_payload->>'forma_pagamento', v_old.forma_pagamento),
    v_desconto, v_juros, v_multa, v_abatimento,
    COALESCE(p_payload->>'observacoes', v_old.observacoes),
    v_valor_pago - v_desconto + v_juros + v_multa - v_abatimento,
    v_old.grupo_baixa_id,
    v_old.caixa_movimento_registrado,
    CASE WHEN v_old.conciliacao_status = 'desconciliado'
         THEN 'conciliado' ELSE v_old.conciliacao_status END,
    v_old.conciliacao_extrato_referencia,
    v_old.conciliacao_data,
    v_old.conciliacao_usuario
  ) RETURNING id INTO v_nova_id;

  -- Reaponta a linha de extrato (reaberta pelo estorno) para a nova baixa.
  IF v_old.conciliacao_status = 'conciliado' THEN
    UPDATE public.financeiro_extrato_importacoes
       SET status = 'conciliado', baixa_id = v_nova_id, updated_at = now()
     WHERE conta_bancaria_id = v_old.conta_bancaria_id
       AND fitid = v_old.conciliacao_extrato_referencia;
  END IF;

  INSERT INTO public.auditoria_logs (tabela, acao, registro_id, usuario_id, dados_anteriores, dados_novos)
  VALUES (
    'financeiro_baixas',
    'edicao_privilegiada',
    p_baixa_id::text,
    v_uid,
    jsonb_build_object('motivo', p_motivo, 'antes', to_jsonb(v_old)),
    jsonb_build_object('nova_baixa_id', v_nova_id, 'payload', p_payload)
  );

  RETURN jsonb_build_object('baixa_antiga_id', p_baixa_id, 'nova_baixa_id', v_nova_id);
END;
$function$;


-- ============================================================
-- 6) saldo_restante congelado quando o valor do título muda
-- ============================================================
-- trg_sync_financeiro_saldo só dispara em financeiro_baixas. Quando
-- financeiro_lancamentos.valor era atualizado (ex.: trg_sync_cartao_fatura_total
-- recalculando a fatura), saldo_restante ficava congelado no valor antigo —
-- inflando o contas a pagar em aberto e afrouxando o teto de
-- registrar_baixa_financeira, que valida contra saldo_restante.
CREATE OR REPLACE FUNCTION public.trg_financeiro_resync_saldo_valor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pago numeric;
  v_tem_baixa boolean;
  v_saldo numeric;
BEGIN
  IF NEW.valor IS NOT DISTINCT FROM OLD.valor THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'cancelado' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(valor_pago), 0), COUNT(*) > 0
    INTO v_pago, v_tem_baixa
    FROM public.financeiro_baixas
   WHERE lancamento_id = NEW.id
     AND estornada_em IS NULL;

  v_saldo := GREATEST(COALESCE(NEW.valor, 0) - v_pago, 0);
  NEW.saldo_restante := v_saldo;

  -- Só recalcula status quando existe baixa ativa. Sem baixas, preserva o
  -- status atual — protege os títulos de carga inicial gravados como 'pago'
  -- sem baixa correspondente, que não devem reabrir por uma edição de valor.
  IF v_tem_baixa THEN
    NEW.valor_pago := v_pago;
    NEW.status := CASE WHEN v_saldo <= 0.005 THEN 'pago' ELSE 'parcial' END;
  END IF;

  RETURN NEW;
END;
$function$;

-- Nome escolhido para ordenar antes de trg_lancamento_status_requer_baixa
-- (triggers BEFORE disparam em ordem alfabética), de modo que o guard de
-- status enxergue o valor já recalculado.
DROP TRIGGER IF EXISTS trg_financeiro_resync_saldo_valor ON public.financeiro_lancamentos;
CREATE TRIGGER trg_financeiro_resync_saldo_valor
BEFORE UPDATE OF valor ON public.financeiro_lancamentos
FOR EACH ROW EXECUTE FUNCTION public.trg_financeiro_resync_saldo_valor();


-- ============================================================
-- 7) Correção dos saldos já divergentes
-- ============================================================
-- Só toca linhas SEM baixa ativa e em status 'aberto'/'cancelado':
--   • não altera valor_pago nem status, evitando disparar
--     trg_lancamento_status_requer_baixa;
--   • preserva intencionalmente os títulos de carga inicial em status 'pago'
--     sem baixa (42 registros de 21/04/2026), que representam liquidações
--     históricas anteriores ao módulo de baixas.
UPDATE public.financeiro_lancamentos l
   SET saldo_restante = GREATEST(COALESCE(l.valor, 0), 0),
       updated_at = now()
 WHERE l.status IN ('aberto', 'cancelado')
   AND NOT EXISTS (
     SELECT 1 FROM public.financeiro_baixas b
      WHERE b.lancamento_id = l.id AND b.estornada_em IS NULL
   )
   AND ABS(COALESCE(l.saldo_restante, 0) - COALESCE(l.valor, 0)) > 0.01;
