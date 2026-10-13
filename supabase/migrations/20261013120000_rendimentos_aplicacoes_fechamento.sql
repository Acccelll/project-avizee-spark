-- Rendimentos de aplicações (CDB, reserva remunerada, CDI da carteira) no
-- fechamento. Até aqui eles só apareciam dentro do ajuste ao extrato: o saldo
-- do banco crescia e o ERP não sabia por quê. Agora o rendimento do mês é um
-- recebimento na conta 6.1.2.01.001, entra no caixa calculado e aparece numa
-- linha própria do Workbook e da apresentação.

-- 1. Conta contábil -----------------------------------------------------------
INSERT INTO contas_contabeis (codigo, descricao, natureza, aceita_lancamento, conta_pai_id)
SELECT '6.1.2', 'Rendimentos de Aplicações', 'credora', false, id
  FROM contas_contabeis WHERE codigo = '6.1'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO contas_contabeis (codigo, descricao, natureza, aceita_lancamento, conta_pai_id)
SELECT '6.1.2.01', 'Rendimentos de Aplicações Financeiras', 'credora', false, id
  FROM contas_contabeis WHERE codigo = '6.1.2'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO contas_contabeis (codigo, descricao, natureza, aceita_lancamento, conta_pai_id)
SELECT '6.1.2.01.001', 'Rendimentos de Aplicações Financeiras', 'credora', true, id
  FROM contas_contabeis WHERE codigo = '6.1.2.01'
ON CONFLICT (codigo) DO NOTHING;

-- 2. Rendimentos recebidos no período (mesma base do recebido em _wb_caixa) ----
CREATE OR REPLACE FUNCTION public._wb_rendimentos(p_emp uuid, p_ini date, p_fim date)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT coalesce(sum(x.v), 0) FROM (
    SELECT b.valor_pago AS v
      FROM financeiro_baixas b
      JOIN financeiro_lancamentos fl ON fl.id = b.lancamento_id
      JOIN contas_contabeis cc ON cc.id = fl.conta_contabil_id
     WHERE fl.empresa_id = p_emp AND fl.tipo = 'receber' AND fl.status <> 'cancelado'
       AND b.estornada_em IS NULL AND b.data_baixa BETWEEN p_ini AND p_fim
       AND cc.codigo LIKE '6.1.2.%'
    UNION ALL
    SELECT fl.valor_pago
      FROM financeiro_lancamentos fl
      JOIN contas_contabeis cc ON cc.id = fl.conta_contabil_id
     WHERE fl.empresa_id = p_emp AND fl.tipo = 'receber' AND fl.status = 'pago'
       AND fl.data_pagamento BETWEEN p_ini AND p_fim
       AND NOT EXISTS (SELECT 1 FROM financeiro_baixas b WHERE b.lancamento_id = fl.id AND b.estornada_em IS NULL)
       AND cc.codigo LIKE '6.1.2.%'
  ) x;
$$;

REVOKE ALL ON FUNCTION public._wb_rendimentos(uuid, date, date) FROM PUBLIC, anon, authenticated;

-- 3. Workbook: rendimentos do mês ao lado do recebido -------------------------
DO $$
DECLARE
  v_def text;
  v_novo text;
BEGIN
  v_def := pg_get_functiondef('public.workbook_fechamento_dados(text)'::regprocedure);
  IF v_def ~ '_wb_rendimentos' THEN
    RETURN;
  END IF;
  v_novo := replace(
    v_def,
    $f$v_val := v_val || jsonb_build_object('receita_caixa', v_rec, 'despesa_caixa', v_desp);$f$,
    $f$v_val := v_val || jsonb_build_object('receita_caixa', v_rec, 'despesa_caixa', v_desp,
        'rendimentos', _wb_rendimentos(v_emp, v_mes, v_fim));$f$);
  IF v_novo = v_def THEN
    RAISE EXCEPTION 'workbook_fechamento_dados: trecho do recebido não encontrado.';
  END IF;
  EXECUTE v_novo;
END;
$$;

-- 4. Informar o rendimento do mês no fechamento --------------------------------
-- Mantém um recebimento do sistema por mês (origem 'fechamento_rendimentos')
-- tal que o total de rendimentos do mês seja p_valor. Rendimentos lançados à
-- mão no Financeiro contam no total; o do sistema completa a diferença.
CREATE OR REPLACE FUNCTION public.registrar_rendimentos_mes(p_competencia text, p_valor numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_emp uuid := current_empresa_id();
  v_ini date;
  v_fim date;
  v_conta uuid;
  v_id uuid;
  v_proprio_atual numeric := 0;
  v_outros numeric;
  v_proprio numeric;
  v_desc text;
BEGIN
  IF v_emp IS NULL THEN
    RAISE EXCEPTION 'Empresa do usuário não identificada.' USING ERRCODE = '42501';
  END IF;
  IF p_competencia !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'Competência inválida: % (use AAAA-MM)', p_competencia USING ERRCODE = '22023';
  END IF;
  IF p_valor IS NOT NULL AND p_valor < 0 THEN
    RAISE EXCEPTION 'Rendimento não pode ser negativo.' USING ERRCODE = '22023';
  END IF;
  v_ini := (p_competencia || '-01')::date;
  v_fim := (v_ini + interval '1 month - 1 day')::date;
  SELECT id INTO v_conta FROM contas_contabeis WHERE codigo = '6.1.2.01.001';

  SELECT id, coalesce(valor_pago, 0)
    INTO v_id, v_proprio_atual
    FROM financeiro_lancamentos
   WHERE empresa_id = v_emp AND origem_tabela = 'fechamento_rendimentos' AND origem_descricao = p_competencia
     AND ativo AND status = 'pago'
   ORDER BY created_at DESC
   LIMIT 1;

  -- Mesma soma de _wb_rendimentos, mas sob o RLS de quem chama.
  SELECT coalesce(sum(x.v), 0) - coalesce(v_proprio_atual, 0) INTO v_outros FROM (
    SELECT b.valor_pago AS v
      FROM financeiro_baixas b
      JOIN financeiro_lancamentos fl ON fl.id = b.lancamento_id
      JOIN contas_contabeis cc ON cc.id = fl.conta_contabil_id
     WHERE fl.empresa_id = v_emp AND fl.tipo = 'receber' AND fl.status <> 'cancelado'
       AND b.estornada_em IS NULL AND b.data_baixa BETWEEN v_ini AND v_fim
       AND cc.codigo LIKE '6.1.2.%'
    UNION ALL
    SELECT fl.valor_pago
      FROM financeiro_lancamentos fl
      JOIN contas_contabeis cc ON cc.id = fl.conta_contabil_id
     WHERE fl.empresa_id = v_emp AND fl.tipo = 'receber' AND fl.status = 'pago'
       AND fl.data_pagamento BETWEEN v_ini AND v_fim
       AND NOT EXISTS (SELECT 1 FROM financeiro_baixas b WHERE b.lancamento_id = fl.id AND b.estornada_em IS NULL)
       AND cc.codigo LIKE '6.1.2.%'
  ) x;
  v_proprio := round(coalesce(p_valor, 0) - v_outros, 2);
  IF v_proprio < 0 THEN
    RAISE EXCEPTION 'Já há % de rendimentos lançados no Financeiro em %; informe um total maior ou ajuste os lançamentos.',
      to_char(v_outros, 'FM999G999G990D00'), p_competencia USING ERRCODE = '22023';
  END IF;

  IF v_id IS NOT NULL AND v_proprio = v_proprio_atual THEN
    RETURN v_outros + v_proprio;
  END IF;
  -- Título pago não muda de valor sem baixa (trg_lancamento_status_requer_baixa):
  -- o anterior é cancelado e, se houver valor, entra um novo.
  IF v_id IS NOT NULL THEN
    UPDATE financeiro_lancamentos
       SET status = 'cancelado', ativo = false,
           motivo_estorno = 'Rendimento do mês alterado no fechamento'
     WHERE id = v_id;
  END IF;
  IF v_proprio = 0 THEN
    RETURN v_outros;
  END IF;

  v_desc := 'Rendimentos de aplicações — ' || to_char(v_ini, 'MM/YYYY');
  INSERT INTO financeiro_lancamentos (
    empresa_id, tipo, descricao, titulo, valor, valor_pago, saldo_restante,
    data_emissao, data_vencimento, data_pagamento, status, forma_pagamento,
    conta_contabil_id, origem_tipo, origem_tabela, origem_descricao, observacoes,
    parcela_numero, parcela_total, ativo)
  VALUES (
    v_emp, 'receber', v_desc, v_desc, v_proprio, v_proprio, 0,
    v_fim, v_fim, v_fim, 'pago', 'transferencia',
    v_conta, 'sistemica', 'fechamento_rendimentos', p_competencia,
    'Informado no fechamento do mês (Entradas do fechamento).',
    1, 1, true);
  RETURN v_outros + v_proprio;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_rendimentos_mes(text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_rendimentos_mes(text, numeric) TO authenticated;
