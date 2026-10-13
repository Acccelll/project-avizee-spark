-- Carteira de pedidos (backlog) no fechamento: pedidos confirmados e ainda
-- sem nota na data-base (fim do mês), por mês previsto de faturamento. É uma
-- fotografia: fica gravada no mês do fechamento em workbook_valores_mensais
-- (metrica 'backlog', chave = mês previsto AAAA-MM) e não muda depois.
--
-- workbook_fechamento_dados passa a devolver:
--   • meses[].valores.backlog_previsto: o que o fechamento do mês anterior
--     previa faturar no mês (para medir a conversão);
--   • carteira: para os 4 meses seguintes à competência, a carteira e os
--     títulos a receber e a pagar em aberto na data-base por mês de vencimento.

-- 1. Títulos em aberto numa data, por mês de vencimento ------------------------
-- Mesmo saldo de _wb_aging (baixas até a data contam; o resto está em aberto).
CREATE OR REPLACE FUNCTION public._wb_abertos_mes(p_emp uuid, p_tipo text, p_fim date)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH ab AS (
    SELECT fl.data_vencimento,
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
  ),
  g AS (
    SELECT CASE WHEN data_vencimento <= p_fim THEN 'vencido' ELSE to_char(data_vencimento, 'YYYY-MM') END AS k,
           round(sum(saldo), 2) AS v
      FROM ab WHERE saldo > 0.005
     GROUP BY 1
  )
  SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb) FROM g;
$$;

-- 2. Carteira e projeção da competência ---------------------------------------
CREATE OR REPLACE FUNCTION public._wb_carteira(p_emp uuid, p_competencia text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ini date := (p_competencia || '-01')::date;
  v_fim date := ((p_competencia || '-01')::date + interval '1 month - 1 day')::date;
  v_rec jsonb := _wb_abertos_mes(p_emp, 'receber', ((p_competencia || '-01')::date + interval '1 month - 1 day')::date);
  v_pag jsonb := _wb_abertos_mes(p_emp, 'pagar', ((p_competencia || '-01')::date + interval '1 month - 1 day')::date);
  v_meses jsonb := '[]'::jsonb;
  v_ult text;
  v_mes text;
  v_bkl numeric;
  v_inf boolean;
  k int;
BEGIN
  SELECT EXISTS (SELECT 1 FROM workbook_valores_mensais
                  WHERE empresa_id = p_emp AND competencia = p_competencia AND metrica = 'backlog')
    INTO v_inf;
  FOR k IN 1..4 LOOP
    v_mes := to_char(v_ini + make_interval(months => k), 'YYYY-MM');
    SELECT valor INTO v_bkl FROM workbook_valores_mensais
     WHERE empresa_id = p_emp AND competencia = p_competencia AND metrica = 'backlog' AND chave = v_mes;
    v_meses := v_meses || jsonb_build_array(jsonb_build_object(
      'mes', v_mes,
      'backlog', CASE WHEN v_inf THEN coalesce(v_bkl, 0) END,
      'receber', coalesce((v_rec->>v_mes)::numeric, 0),
      'pagar', coalesce((v_pag->>v_mes)::numeric, 0)));
    v_bkl := NULL;
  END LOOP;
  v_ult := v_mes;
  RETURN jsonb_build_object(
    'data_base', v_fim,
    'informada', v_inf,
    'meses', v_meses,
    -- Carteira informada para depois do 4º mês (não entra na tabela, entra no total).
    'backlog_depois', (SELECT coalesce(sum(valor), 0) FROM workbook_valores_mensais
                        WHERE empresa_id = p_emp AND competencia = p_competencia AND metrica = 'backlog' AND chave > v_ult),
    'receber_vencido', coalesce((v_rec->>'vencido')::numeric, 0),
    'pagar_vencido', coalesce((v_pag->>'vencido')::numeric, 0),
    'receber_depois', (SELECT coalesce(sum(value::numeric), 0) FROM jsonb_each_text(v_rec) WHERE key <> 'vencido' AND key > v_ult),
    'pagar_depois', (SELECT coalesce(sum(value::numeric), 0) FROM jsonb_each_text(v_pag) WHERE key <> 'vencido' AND key > v_ult));
END;
$$;

REVOKE ALL ON FUNCTION public._wb_abertos_mes(uuid, text, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._wb_carteira(uuid, text) FROM PUBLIC, anon, authenticated;

-- 3. workbook_fechamento_dados: conversão por mês e carteira da competência ----
DO $$
DECLARE
  v_def text;
  v_novo text;
BEGIN
  v_def := pg_get_functiondef('public.workbook_fechamento_dados(text)'::regprocedure);
  IF v_def ~ '_wb_carteira' THEN
    RETURN;
  END IF;
  v_novo := replace(
    v_def,
    $f$'rendimentos', _wb_rendimentos(v_emp, v_mes, v_fim));$f$,
    $f$'rendimentos', _wb_rendimentos(v_emp, v_mes, v_fim));
      -- Carteira que o fechamento do mês anterior previa faturar neste mês.
      v_val := v_val || coalesce((SELECT jsonb_build_object('backlog_previsto', w.valor)
                                    FROM workbook_valores_mensais w
                                   WHERE w.empresa_id = v_emp AND w.metrica = 'backlog'
                                     AND w.competencia = to_char(v_mes - interval '1 month', 'YYYY-MM')
                                     AND w.chave = to_char(v_mes, 'YYYY-MM')), '{}'::jsonb);$f$);
  IF v_novo = v_def THEN
    RAISE EXCEPTION 'workbook_fechamento_dados: trecho dos rendimentos não encontrado.';
  END IF;
  v_def := v_novo;
  v_novo := replace(
    v_def,
    $f$'saldo_caixa_anterior', v_saldo_ant,$f$,
    $f$'saldo_caixa_anterior', v_saldo_ant,
    'carteira', _wb_carteira(v_emp, p_competencia),$f$);
  IF v_novo = v_def THEN
    RAISE EXCEPTION 'workbook_fechamento_dados: trecho do retorno não encontrado.';
  END IF;
  EXECUTE v_novo;
END;
$$;
