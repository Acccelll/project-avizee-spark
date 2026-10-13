-- Despesas por categoria do fechamento (Workbook e apresentação).
--
-- 1. Pagamento de fatura de cartão é repartido pelas categorias dos itens da
--    fatura (conta do lançamento do item, conta sugerida, ou a conta mais
--    usada pelo fornecedor), na proporção de cada item no total da fatura. O
--    que não tem item detalhado ou conta fica em "Cartão: a classificar" (a
--    categoria do emissor do cartão não é usada: é do banco, não do plano).
-- 2. A conta contábil manda: pagamento de nota de entrada só vira
--    "Mercadorias para revenda" quando não tem conta (ex.: frete e Simples
--    Nacional com nota não caem mais em mercadorias).
-- 3. Lançamento sem conta usa a conta mais usada pelo mesmo fornecedor.
-- O total por mês continua igual ao pago (mesma base da despesa de caixa).

CREATE OR REPLACE FUNCTION public._apr_categoria_despesa(p_origem_tabela text, p_origem_tipo text, p_cartao_fatura uuid, p_cc_codigo text, p_cc_descricao text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_origem_tabela = 'socios_retiradas' THEN 'Pró-labore'
    WHEN p_cartao_fatura IS NOT NULL OR p_origem_tipo = 'cartao_fatura' THEN 'Cartão: a classificar'
    WHEN coalesce(p_cc_codigo, '') LIKE '1.1.5.%' THEN 'Mercadorias para revenda'
    WHEN coalesce(p_cc_codigo, '') LIKE '3.1.1.11.%' THEN 'Impostos e taxas'
    WHEN coalesce(p_cc_codigo, '') LIKE '3.1.1.02.%' THEN 'Pessoal'
    WHEN coalesce(p_cc_codigo, '') LIKE '3.2.%' THEN 'Despesas financeiras'
    WHEN nullif(trim(p_cc_descricao), '') IS NOT NULL THEN trim(p_cc_descricao)
    WHEN p_origem_tipo = 'fiscal_nota' THEN 'Mercadorias para revenda'
    ELSE 'Outras despesas'
  END;
$$;

CREATE OR REPLACE FUNCTION public.apresentacao_fechamento_dados(p_competencia text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_emp uuid := current_empresa_id();
  v_comp date;
  v_fim date;
  v_ini date;
  v_wb jsonb;
  v_detalhe jsonb;
  v_grupos jsonb;
  v_primeira jsonb;
  v_pend jsonb;
BEGIN
  IF v_emp IS NULL THEN
    RAISE EXCEPTION 'Empresa do usuário não identificada.' USING ERRCODE = '42501';
  END IF;
  IF p_competencia !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'Competência inválida: % (use AAAA-MM)', p_competencia USING ERRCODE = '22023';
  END IF;
  v_comp := (p_competencia || '-01')::date;
  v_fim := (v_comp + interval '1 month - 1 day')::date;
  v_ini := make_date(extract(year FROM v_comp)::int - 1, 1, 1);

  v_wb := workbook_fechamento_dados(p_competencia);
  -- Parâmetros do ano seguinte, para o slide de metas do deck anual
  -- (o Workbook só traz de ano-2 até o ano da competência).
  v_wb := jsonb_set(v_wb, '{parametros}', coalesce(v_wb->'parametros', '{}'::jsonb) || coalesce((
    SELECT jsonb_object_agg(p.ano::text, jsonb_build_object('crescimento_meta', p.crescimento_meta, 'limite_faturamento', p.limite_faturamento))
      FROM workbook_parametros_anuais p
     WHERE p.empresa_id = v_emp AND p.ano = extract(year FROM v_comp)::int + 1), '{}'::jsonb));

  WITH nf AS (
    SELECT to_char(n.data_emissao, 'YYYY-MM') AS comp,
           n.valor_total AS v,
           _apr_grupo_cliente(c.cpf_cnpj, n.cliente_id) AS k,
           coalesce(nullif(upper(trim(c.uf)), ''), '??') AS uf,
           coalesce(nullif(trim(c.nome_fantasia), ''), nullif(trim(c.nome_razao_social), ''), 'Sem cliente') AS nome
      FROM notas_fiscais n
      LEFT JOIN clientes c ON c.id = n.cliente_id
     WHERE n.empresa_id = v_emp AND n.tipo = 'saida'
       AND n.status IN ('confirmada', 'importada')
       AND n.data_emissao BETWEEN v_ini AND v_fim
  ),
  -- Conta mais usada por fornecedor (fallback de lançamento sem conta).
  conta_forn AS (
    SELECT DISTINCT ON (fl.fornecedor_id) fl.fornecedor_id, fl.conta_contabil_id
      FROM financeiro_lancamentos fl
      JOIN contas_contabeis cc ON cc.id = fl.conta_contabil_id
     WHERE fl.empresa_id = v_emp AND fl.tipo = 'pagar' AND fl.fornecedor_id IS NOT NULL
       AND cc.codigo NOT LIKE '1.1.1.%'
     GROUP BY fl.fornecedor_id, fl.conta_contabil_id
     ORDER BY fl.fornecedor_id, count(*) DESC, max(fl.created_at) DESC
  ),
  -- Pagamentos do período (mesma base da despesa de caixa).
  base AS (
    SELECT b.data_baixa AS d, b.valor_pago AS v, fl.origem_tabela, fl.origem_tipo, fl.cartao_fatura_id,
           coalesce(fl.conta_contabil_id, cf.conta_contabil_id) AS conta_id,
           coalesce(nullif(trim(f.nome_fantasia), ''), nullif(trim(f.nome_razao_social), '')) AS forn
      FROM financeiro_baixas b
      JOIN financeiro_lancamentos fl ON fl.id = b.lancamento_id
      LEFT JOIN contas_contabeis cc ON cc.id = fl.conta_contabil_id
      LEFT JOIN fornecedores f ON f.id = fl.fornecedor_id
      LEFT JOIN conta_forn cf ON cf.fornecedor_id = fl.fornecedor_id
     WHERE fl.empresa_id = v_emp AND fl.tipo = 'pagar' AND fl.status <> 'cancelado'
       AND b.estornada_em IS NULL AND b.data_baixa BETWEEN v_ini AND v_fim
       AND coalesce(cc.codigo, '') NOT LIKE '1.1.1.%'
    UNION ALL
    SELECT fl.data_pagamento, fl.valor_pago, fl.origem_tabela, fl.origem_tipo, fl.cartao_fatura_id,
           coalesce(fl.conta_contabil_id, cf.conta_contabil_id),
           coalesce(nullif(trim(f.nome_fantasia), ''), nullif(trim(f.nome_razao_social), ''))
      FROM financeiro_lancamentos fl
      LEFT JOIN contas_contabeis cc ON cc.id = fl.conta_contabil_id
      LEFT JOIN fornecedores f ON f.id = fl.fornecedor_id
      LEFT JOIN conta_forn cf ON cf.fornecedor_id = fl.fornecedor_id
     WHERE fl.empresa_id = v_emp AND fl.tipo = 'pagar' AND fl.status = 'pago'
       AND fl.data_pagamento BETWEEN v_ini AND v_fim
       AND NOT EXISTS (SELECT 1 FROM financeiro_baixas b WHERE b.lancamento_id = fl.id AND b.estornada_em IS NULL)
       AND coalesce(cc.codigo, '') NOT LIKE '1.1.1.%'
  ),
  -- Itens das faturas de cartão com a conta de cada um.
  fat_itens AS (
    SELECT i.cartao_fatura_id, i.valor,
           coalesce(lc.conta_contabil_id, i.conta_contabil_sugerida_id, cf.conta_contabil_id) AS conta_id
      FROM cartao_fatura_lancamentos i
      JOIN cartao_faturas fa ON fa.id = i.cartao_fatura_id AND fa.empresa_id = v_emp
      LEFT JOIN financeiro_lancamentos lc ON lc.id = i.lancamento_id
      LEFT JOIN conta_forn cf ON cf.fornecedor_id = coalesce(lc.fornecedor_id, i.fornecedor_sugerido_id)
  ),
  fat_soma AS (
    SELECT fa.id, nullif(fa.valor_total, 0) AS total,
           coalesce((SELECT sum(fi.valor) FROM fat_itens fi WHERE fi.cartao_fatura_id = fa.id), 0) AS itens
      FROM cartao_faturas fa
     WHERE fa.empresa_id = v_emp
  ),
  pg AS (
    -- Pagamentos que não são de fatura de cartão.
    SELECT to_char(b.d, 'YYYY-MM') AS comp, b.v,
           _apr_categoria_despesa(b.origem_tabela, b.origem_tipo, b.cartao_fatura_id, cc.codigo, cc.descricao) AS cat,
           b.forn
      FROM base b
      LEFT JOIN contas_contabeis cc ON cc.id = b.conta_id
      LEFT JOIN fat_soma fs ON fs.id = b.cartao_fatura_id
     WHERE b.cartao_fatura_id IS NULL OR fs.total IS NULL
    UNION ALL
    -- Fatura de cartão: repartida pelos itens, na proporção de cada um.
    SELECT to_char(b.d, 'YYYY-MM'), b.v * fi.valor / fs.total,
           CASE WHEN cc.id IS NOT NULL THEN _apr_categoria_despesa(NULL, NULL, NULL, cc.codigo, cc.descricao)
                ELSE 'Cartão: a classificar' END,
           b.forn
      FROM base b
      JOIN fat_soma fs ON fs.id = b.cartao_fatura_id AND fs.total IS NOT NULL
      JOIN fat_itens fi ON fi.cartao_fatura_id = b.cartao_fatura_id
      LEFT JOIN contas_contabeis cc ON cc.id = fi.conta_id
    UNION ALL
    -- Parte da fatura sem item detalhado.
    SELECT to_char(b.d, 'YYYY-MM'), b.v * (fs.total - fs.itens) / fs.total, 'Cartão: a classificar', b.forn
      FROM base b
      JOIN fat_soma fs ON fs.id = b.cartao_fatura_id AND fs.total IS NOT NULL
     WHERE fs.total <> fs.itens
  ),
  meses AS (
    SELECT to_char(m, 'YYYY-MM') AS comp FROM generate_series(v_ini, v_comp, interval '1 month') m
  )
  SELECT jsonb_object_agg(meses.comp, jsonb_build_object(
    'clientes', coalesce((SELECT jsonb_agg(jsonb_build_object('k', k, 'v', v, 'nf', n) ORDER BY v DESC)
                            FROM (SELECT k, round(sum(v), 2) AS v, count(*) AS n FROM nf WHERE nf.comp = meses.comp GROUP BY k) a), '[]'::jsonb),
    'uf', coalesce((SELECT jsonb_object_agg(uf, v)
                      FROM (SELECT uf, round(sum(v), 2) AS v FROM nf WHERE nf.comp = meses.comp GROUP BY uf) a), '{}'::jsonb),
    'despesas', coalesce((SELECT jsonb_object_agg(cat, v)
                            FROM (SELECT cat, round(sum(v), 2) AS v FROM pg WHERE pg.comp = meses.comp GROUP BY cat
                                  HAVING round(sum(v), 2) <> 0) a), '{}'::jsonb),
    'fornecedores', coalesce((SELECT jsonb_agg(jsonb_build_object('nome', forn, 'v', v) ORDER BY v DESC)
                                FROM (SELECT forn, round(sum(v), 2) AS v FROM pg
                                       WHERE pg.comp = meses.comp AND forn IS NOT NULL
                                       GROUP BY forn ORDER BY 2 DESC LIMIT 10) a), '[]'::jsonb)))
    INTO v_detalhe
    FROM meses;

  WITH nf AS (
    SELECT _apr_grupo_cliente(c.cpf_cnpj, n.cliente_id) AS k,
           coalesce(nullif(trim(c.nome_fantasia), ''), nullif(trim(c.nome_razao_social), ''), 'Sem cliente') AS nome,
           n.valor_total AS v, n.data_emissao AS d
      FROM notas_fiscais n
      LEFT JOIN clientes c ON c.id = n.cliente_id
     WHERE n.empresa_id = v_emp AND n.tipo = 'saida'
       AND n.status IN ('confirmada', 'importada')
       AND n.data_emissao <= v_fim
  ),
  nomes AS (
    SELECT DISTINCT ON (k) k, nome
      FROM (SELECT k, nome, sum(v) FILTER (WHERE d > v_fim - 365) AS vr, sum(v) AS v FROM nf GROUP BY k, nome) a
     ORDER BY k, vr DESC NULLS LAST, v DESC
  )
  SELECT (SELECT coalesce(jsonb_object_agg(k, nome), '{}'::jsonb) FROM nomes),
         (SELECT coalesce(jsonb_object_agg(k, comp), '{}'::jsonb)
            FROM (SELECT k, to_char(min(d), 'YYYY-MM') AS comp FROM nf GROUP BY k) a)
    INTO v_grupos, v_primeira;

  v_pend := jsonb_build_object(
    'extrato_pendentes', (SELECT count(*) FROM financeiro_extrato_importacoes e
                            JOIN contas_bancarias cb ON cb.id = e.conta_bancaria_id AND cb.ativo
                           WHERE e.empresa_id = v_emp AND e.status = 'pendente'
                             AND e.data BETWEEN v_comp AND v_fim),
    'extrato_ultima_data', (SELECT max(e.data) FROM financeiro_extrato_importacoes e
                             WHERE e.empresa_id = v_emp AND e.data <= v_fim),
    'notas_saida_mes', (SELECT count(*) FROM notas_fiscais n
                         WHERE n.empresa_id = v_emp AND n.tipo = 'saida'
                           AND n.status IN ('confirmada', 'importada')
                           AND n.data_emissao BETWEEN v_comp AND v_fim));

  RETURN jsonb_build_object(
    'competencia', p_competencia,
    'workbook', v_wb,
    'detalhe', coalesce(v_detalhe, '{}'::jsonb),
    'grupos', coalesce(v_grupos, '{}'::jsonb),
    'primeira_compra', coalesce(v_primeira, '{}'::jsonb),
    'pendencias', v_pend);
END;
$function$;
