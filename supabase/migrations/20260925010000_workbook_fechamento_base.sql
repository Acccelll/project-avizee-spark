-- Base de dados do Workbook de Fechamento (modelo "Financeiro_workbook" da AviZee).
--
-- O Workbook legado consolidava, por vínculo externo, células fixas dos arquivos
-- mensais do fechamento (CR/CP → TOTAIS, FC Liq, FOPAG, Faturamento,
-- Almoxarifado). Aqui essas séries passam a vir do ERP, sempre em regime de
-- caixa, com três fontes por métrica e mês:
--   1. workbook_valores_mensais (fonte 'historico' ou 'manual') — tem precedência;
--      guarda o histórico anterior ao ERP e o que não é automatizável (seguidores);
--   2. cálculo sobre o ERP (fonte 'erp');
--   3. nulo quando o mês é posterior à competência pedida.

ALTER TABLE public.socios ADD COLUMN IF NOT EXISTS nome_exibicao text;
COMMENT ON COLUMN public.socios.nome_exibicao IS
  'Nome curto usado em relatórios gerenciais (ex.: Workbook de Fechamento). Vazio = primeiro + último nome.';

CREATE TABLE IF NOT EXISTS public.workbook_valores_mensais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT current_empresa_id(),
  competencia text NOT NULL,
  metrica text NOT NULL,
  chave text NOT NULL DEFAULT '',
  valor numeric NOT NULL,
  fonte text NOT NULL DEFAULT 'manual',
  observacao text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  CONSTRAINT chk_wb_valores_competencia CHECK (competencia ~ '^\d{4}-\d{2}$'),
  CONSTRAINT chk_wb_valores_fonte CHECK (fonte IN ('historico', 'manual')),
  CONSTRAINT uq_wb_valores UNIQUE (empresa_id, competencia, metrica, chave)
);
COMMENT ON TABLE public.workbook_valores_mensais IS
  'Valores mensais que prevalecem sobre o cálculo do ERP no Workbook de Fechamento: histórico anterior ao ERP e entradas manuais (ex.: seguidores). chave = socio_id nas métricas por sócio.';

ALTER TABLE public.workbook_valores_mensais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wb_valores_empresa_select ON public.workbook_valores_mensais;
DROP POLICY IF EXISTS wb_valores_empresa_write ON public.workbook_valores_mensais;
CREATE POLICY wb_valores_empresa_select ON public.workbook_valores_mensais FOR SELECT TO authenticated
  USING (empresa_id = current_empresa_id());
CREATE POLICY wb_valores_empresa_write ON public.workbook_valores_mensais FOR ALL TO authenticated
  USING (empresa_id = current_empresa_id()) WITH CHECK (empresa_id = current_empresa_id());

CREATE TABLE IF NOT EXISTS public.workbook_parametros_anuais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT current_empresa_id(),
  ano integer NOT NULL,
  crescimento_meta numeric NOT NULL DEFAULT 0,
  limite_faturamento numeric NOT NULL DEFAULT 360000,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  CONSTRAINT chk_wb_param_ano CHECK (ano BETWEEN 2000 AND 2100),
  CONSTRAINT uq_wb_param_ano UNIQUE (empresa_id, ano)
);
COMMENT ON TABLE public.workbook_parametros_anuais IS
  'Parâmetros por ano do Workbook de Fechamento: crescimento da meta de faturamento sobre o ano anterior (fração, 0.085 = 8,5%) e limite anual de faturamento do enquadramento.';

ALTER TABLE public.workbook_parametros_anuais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wb_param_empresa_select ON public.workbook_parametros_anuais;
DROP POLICY IF EXISTS wb_param_empresa_write ON public.workbook_parametros_anuais;
CREATE POLICY wb_param_empresa_select ON public.workbook_parametros_anuais FOR SELECT TO authenticated
  USING (empresa_id = current_empresa_id());
CREATE POLICY wb_param_empresa_write ON public.workbook_parametros_anuais FOR ALL TO authenticated
  USING (empresa_id = current_empresa_id()) WITH CHECK (empresa_id = current_empresa_id());

-- Recebido/pago no período (regime de caixa): baixas não estornadas pela data da
-- baixa + lançamentos quitados sem baixa (importação legada) pela data de
-- pagamento. Exclui disponibilidades (1.1.1.*: saldo de exercício anterior,
-- aplicações e transferências), como o fechamento faz.
CREATE OR REPLACE FUNCTION public._wb_caixa(p_emp uuid, p_tipo text, p_ini date, p_fim date, p_incluir_disponivel boolean DEFAULT false)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT coalesce(sum(x.v), 0) FROM (
    SELECT b.valor_pago AS v
      FROM financeiro_baixas b
      JOIN financeiro_lancamentos fl ON fl.id = b.lancamento_id
      LEFT JOIN contas_contabeis cc ON cc.id = fl.conta_contabil_id
     WHERE fl.empresa_id = p_emp AND fl.tipo = p_tipo AND fl.status <> 'cancelado'
       AND b.estornada_em IS NULL AND b.data_baixa BETWEEN p_ini AND p_fim
       AND (p_incluir_disponivel OR coalesce(cc.codigo, '') NOT LIKE '1.1.1.%')
    UNION ALL
    SELECT fl.valor_pago
      FROM financeiro_lancamentos fl
      LEFT JOIN contas_contabeis cc ON cc.id = fl.conta_contabil_id
     WHERE fl.empresa_id = p_emp AND fl.tipo = p_tipo AND fl.status = 'pago'
       AND fl.data_pagamento BETWEEN p_ini AND p_fim
       AND NOT EXISTS (SELECT 1 FROM financeiro_baixas b WHERE b.lancamento_id = fl.id AND b.estornada_em IS NULL)
       AND (p_incluir_disponivel OR coalesce(cc.codigo, '') NOT LIKE '1.1.1.%')
  ) x;
$$;

-- Saldo em aberto no fim do mês, por faixa de dias até o vencimento (a vencer)
-- ou desde o vencimento (vencido). Reconstrução a partir das baixas; o
-- snapshot do fechamento mensal (quando existir) prevalece via
-- workbook_valores_mensais.
CREATE OR REPLACE FUNCTION public._wb_aging(p_emp uuid, p_tipo text, p_fim date)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH ab AS (
    SELECT fl.data_vencimento - p_fim AS dias,
           fl.valor
           - coalesce((SELECT sum(b.valor_pago) FROM financeiro_baixas b
                        WHERE b.lancamento_id = fl.id AND b.estornada_em IS NULL AND b.data_baixa <= p_fim), 0)
           - CASE WHEN fl.status = 'pago' AND fl.data_pagamento <= p_fim
                   AND NOT EXISTS (SELECT 1 FROM financeiro_baixas b WHERE b.lancamento_id = fl.id AND b.estornada_em IS NULL)
                  THEN fl.valor_pago ELSE 0 END AS saldo
      FROM financeiro_lancamentos fl
     WHERE fl.empresa_id = p_emp AND fl.tipo = p_tipo AND fl.ativo AND fl.status <> 'cancelado'
       AND coalesce(fl.data_emissao, fl.data_vencimento) <= p_fim
       AND NOT (fl.status = 'pago' AND fl.data_pagamento <= p_fim
                AND NOT EXISTS (SELECT 1 FROM financeiro_baixas b WHERE b.lancamento_id = fl.id AND b.estornada_em IS NULL AND b.data_baixa > p_fim))
  )
  SELECT jsonb_build_object(
    'av_0_30',    coalesce(sum(saldo) FILTER (WHERE dias BETWEEN 0 AND 30), 0),
    'av_31_60',   coalesce(sum(saldo) FILTER (WHERE dias BETWEEN 31 AND 60), 0),
    'av_61_90',   coalesce(sum(saldo) FILTER (WHERE dias BETWEEN 61 AND 90), 0),
    'av_90p',     coalesce(sum(saldo) FILTER (WHERE dias > 90), 0),
    'vc_0_30',    coalesce(sum(saldo) FILTER (WHERE dias BETWEEN -30 AND -1), 0),
    'vc_31_60',   coalesce(sum(saldo) FILTER (WHERE dias BETWEEN -60 AND -31), 0),
    'vc_61_90',   coalesce(sum(saldo) FILTER (WHERE dias BETWEEN -90 AND -61), 0),
    'vc_91_120',  coalesce(sum(saldo) FILTER (WHERE dias BETWEEN -120 AND -91), 0),
    'vc_121_180', coalesce(sum(saldo) FILTER (WHERE dias BETWEEN -180 AND -121), 0),
    'vc_181_360', coalesce(sum(saldo) FILTER (WHERE dias BETWEEN -360 AND -181), 0),
    'vc_360p',    coalesce(sum(saldo) FILTER (WHERE dias < -360), 0))
  FROM ab WHERE saldo > 0.005;
$$;

-- Estoque a custo no fim do mês: saldo do último movimento até a data (ou o
-- saldo anterior ao primeiro movimento posterior; sem movimentos, o atual),
-- valorizado pelo custo do cadastro. Insumos = "Materiais"; demais = "Produtos".
CREATE OR REPLACE FUNCTION public._wb_estoque(p_emp uuid, p_fim date)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH q AS (
    SELECT p.tipo_item, coalesce(p.preco_custo, 0) AS custo,
           coalesce(
             (SELECT m.saldo_atual FROM estoque_movimentos m
               WHERE m.produto_id = p.id AND m.created_at < (p_fim + 1)
               ORDER BY m.created_at DESC LIMIT 1),
             (SELECT m.saldo_anterior FROM estoque_movimentos m
               WHERE m.produto_id = p.id AND m.created_at >= (p_fim + 1)
               ORDER BY m.created_at ASC LIMIT 1),
             p.estoque_atual, 0) AS qtd
      FROM produtos p
     WHERE p.empresa_id = p_emp AND p.deleted_at IS NULL AND coalesce(p.tipo_item, 'produto') <> 'servico'
  )
  SELECT jsonb_build_object(
    'materiais', coalesce(sum(greatest(qtd, 0) * custo) FILTER (WHERE tipo_item = 'insumo'), 0),
    'produtos',  coalesce(sum(greatest(qtd, 0) * custo) FILTER (WHERE coalesce(tipo_item, 'produto') <> 'insumo'), 0))
  FROM q;
$$;

REVOKE ALL ON FUNCTION public._wb_caixa(uuid, text, date, date, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._wb_aging(uuid, text, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._wb_estoque(uuid, date) FROM PUBLIC, anon, authenticated;

-- Séries do Workbook de Fechamento para o ano da competência: 37 meses, de
-- dezembro de (ano-3) a dezembro do ano (os blocos ano-2, ano-1 e ano do
-- modelo, mais o mês anterior usado como saldo inicial).
CREATE OR REPLACE FUNCTION public.workbook_fechamento_dados(p_competencia text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_emp uuid := current_empresa_id();
  v_comp date;
  v_ano int;
  v_ini date;
  v_mes date;
  v_fim date;
  v_meses jsonb := '[]'::jsonb;
  v_val jsonb;
  v_fonte jsonb;
  v_soc jsonb;
  v_aging jsonb;
  v_est jsonb;
  v_rec numeric; v_desp numeric;
  v_lucro_ytd numeric := 0;
  v_bloqueado_atual numeric;
  v_saldo_ant numeric := 0;
  r record;
  s record;
  k text;
  v_faixas text[] := ARRAY['av_0_30','av_31_60','av_61_90','av_90p','vc_0_30','vc_31_60','vc_61_90',
                           'vc_91_120','vc_121_180','vc_181_360','vc_360p'];
BEGIN
  IF v_emp IS NULL THEN
    RAISE EXCEPTION 'Empresa do usuário não identificada.' USING ERRCODE = '42501';
  END IF;
  IF p_competencia !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'Competência inválida: % (use AAAA-MM)', p_competencia USING ERRCODE = '22023';
  END IF;
  v_comp := (p_competencia || '-01')::date;
  v_ano := extract(year FROM v_comp)::int;
  v_ini := make_date(v_ano - 3, 12, 1);

  SELECT coalesce(sum(limite), 0) INTO v_bloqueado_atual
    FROM cartoes_credito WHERE empresa_id = v_emp AND ativo;

  -- Resultado de caixa acumulado antes da janela (base do "Caixa" acumulado).
  SELECT coalesce(sum(CASE WHEN metrica = 'receita_caixa' THEN valor ELSE -valor END), 0)
    INTO v_saldo_ant
    FROM workbook_valores_mensais
   WHERE empresa_id = v_emp AND metrica IN ('receita_caixa', 'despesa_caixa') AND chave = ''
     AND competencia < to_char(v_ini, 'YYYY-MM');
  v_saldo_ant := v_saldo_ant
    + _wb_caixa(v_emp, 'receber', '1900-01-01', v_ini - 1)
    - _wb_caixa(v_emp, 'pagar', '1900-01-01', v_ini - 1);

  FOR r IN SELECT generate_series(v_ini, make_date(v_ano, 12, 1), interval '1 month')::date AS mes LOOP
    v_mes := r.mes;
    v_fim := (v_mes + interval '1 month - 1 day')::date;
    v_val := '{}'::jsonb;
    v_fonte := '{}'::jsonb;
    v_soc := '{}'::jsonb;

    IF v_mes <= v_comp THEN
      v_rec := _wb_caixa(v_emp, 'receber', v_mes, v_fim);
      v_desp := _wb_caixa(v_emp, 'pagar', v_mes, v_fim);
      v_val := v_val || jsonb_build_object('receita_caixa', v_rec, 'despesa_caixa', v_desp);
      v_val := v_val || jsonb_build_object('faturamento',
        (SELECT coalesce(sum(nf.valor_total), 0) FROM notas_fiscais nf
          WHERE nf.empresa_id = v_emp AND nf.tipo = 'saida'
            AND nf.status IN ('confirmada', 'importada')
            AND nf.data_emissao BETWEEN v_mes AND v_fim));
      v_val := v_val || jsonb_build_object('bloqueado', v_bloqueado_atual);
      v_est := _wb_estoque(v_emp, v_fim);
      v_val := v_val || jsonb_build_object('estoque_materiais', v_est->'materiais', 'estoque_produtos', v_est->'produtos');
      v_aging := _wb_aging(v_emp, 'receber', v_fim);
      FOREACH k IN ARRAY v_faixas LOOP
        v_val := v_val || jsonb_build_object('aging_cr_' || k, v_aging->k);
      END LOOP;
      v_aging := _wb_aging(v_emp, 'pagar', v_fim);
      FOREACH k IN ARRAY v_faixas LOOP
        v_val := v_val || jsonb_build_object('aging_cp_' || k, v_aging->k);
      END LOOP;
      SELECT jsonb_object_agg(key, 'erp'::text) INTO v_fonte FROM jsonb_object_keys(v_val) key;

      -- Resultado do exercício acumulado (base do rateio por sócio): saldo de
      -- exercício anterior lançado no ano + recebido - pago, jan até o mês.
      IF extract(month FROM v_mes) = 1 THEN
        v_lucro_ytd := 0;
      END IF;
      v_lucro_ytd := v_lucro_ytd + _wb_caixa(v_emp, 'receber', v_mes, v_fim, true) - v_desp;

      FOR s IN SELECT id, percentual_participacao_atual AS pct FROM socios WHERE empresa_id = v_emp AND ativo LOOP
        v_soc := v_soc || jsonb_build_object(s.id::text, jsonb_build_object(
          'saldo', round(v_lucro_ytd * s.pct / 100, 2),
          'prolabore', (SELECT coalesce(sum(coalesce(sr.valor_aprovado, sr.valor_calculado)), 0)
                          FROM socios_retiradas sr
                         WHERE sr.socio_id = s.id AND sr.tipo = 'pro_labore'
                           AND sr.status IN ('aprovado', 'financeiro_gerado', 'pago')
                           AND sr.competencia = to_char(v_mes, 'YYYY-MM')),
          'fonte', 'erp'));
      END LOOP;
    END IF;

    -- Valores gravados (histórico/manual) prevalecem, inclusive em meses futuros
    -- já informados (ex.: seguidores digitados).
    FOR s IN SELECT metrica, chave, valor, fonte FROM workbook_valores_mensais
              WHERE empresa_id = v_emp AND competencia = to_char(v_mes, 'YYYY-MM') AND v_mes <= v_comp LOOP
      IF s.chave = '' THEN
        v_val := v_val || jsonb_build_object(s.metrica, s.valor);
        v_fonte := v_fonte || jsonb_build_object(s.metrica, s.fonte);
      ELSIF s.metrica IN ('socio_saldo', 'socio_prolabore') THEN
        v_soc := v_soc || jsonb_build_object(s.chave,
          coalesce(v_soc->s.chave, '{}'::jsonb)
            || jsonb_build_object(CASE s.metrica WHEN 'socio_saldo' THEN 'saldo' ELSE 'prolabore' END, s.valor, 'fonte', s.fonte));
      END IF;
    END LOOP;

    v_meses := v_meses || jsonb_build_array(jsonb_build_object(
      'competencia', to_char(v_mes, 'YYYY-MM'),
      'fechado', v_mes <= v_comp,
      'valores', v_val,
      'fontes', coalesce(v_fonte, '{}'::jsonb),
      'socios', v_soc));
  END LOOP;

  RETURN jsonb_build_object(
    'competencia', p_competencia,
    'ano', v_ano,
    'saldo_caixa_anterior', v_saldo_ant,
    'meses', v_meses,
    'socios', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                  'id', s2.id, 'nome', s2.nome,
                  'nome_exibicao', coalesce(nullif(trim(s2.nome_exibicao), ''),
                                            initcap(split_part(s2.nome, ' ', 1)) || ' ' ||
                                            initcap(regexp_replace(s2.nome, '^.* ', ''))),
                  'percentual', s2.percentual_participacao_atual)
                ORDER BY coalesce(nullif(trim(s2.nome_exibicao), ''), s2.nome)), '[]'::jsonb)
                 FROM socios s2 WHERE s2.empresa_id = v_emp AND s2.ativo),
    'parametros', (SELECT coalesce(jsonb_object_agg(p.ano::text, jsonb_build_object(
                     'crescimento_meta', p.crescimento_meta, 'limite_faturamento', p.limite_faturamento)), '{}'::jsonb)
                     FROM workbook_parametros_anuais p
                    WHERE p.empresa_id = v_emp AND p.ano BETWEEN v_ano - 2 AND v_ano)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.workbook_fechamento_dados(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.workbook_fechamento_dados(text) TO authenticated;
