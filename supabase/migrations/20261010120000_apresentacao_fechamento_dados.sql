-- Apresentação de Fechamento (modelo novo): uma única fonte de dados.
--
-- `apresentacao_fechamento_dados(p_competencia)` devolve:
--   workbook     → o mesmo retorno de workbook_fechamento_dados (séries de 37
--                  meses: faturamento, caixa, aging, estoque, sócios, parâmetros),
--                  com os parâmetros do ano seguinte acrescentados.
--                  Todos os números agregados do deck saem daqui, para baterem
--                  com o Workbook de Fechamento.
--   detalhe      → por mês, de jan/(ano-1) até a competência: faturamento por
--                  grupo de cliente (CNPJ raiz), por UF do cliente, pagamentos
--                  por categoria e maiores fornecedores. As somas por mês são as
--                  mesmas do Workbook (mesmos filtros de nota e de baixa).
--   grupos       → nome de exibição de cada grupo de cliente.
--   primeira_compra → mês da primeira nota de cada grupo (para "clientes novos").
--   pendencias   → o que falta no fechamento do mês (aviso na página): linhas
--                  do extrato do mês ainda pendentes nas contas ativas, data do
--                  último extrato e notas de saída do mês.
--
-- Também deixa o histórico de gerações pronto para o modelo novo: a versão
-- (mensal, trimestral, anual) e a competência ficam em colunas próprias, e o
-- template deixa de ser obrigatório.

CREATE OR REPLACE FUNCTION public._apr_categoria_despesa(p_origem_tabela text, p_origem_tipo text, p_cartao_fatura uuid, p_cc_codigo text, p_cc_descricao text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_origem_tabela = 'socios_retiradas' THEN 'Pró-labore'
    WHEN p_cartao_fatura IS NOT NULL OR p_origem_tipo = 'cartao_fatura' THEN 'Faturas de cartão'
    WHEN p_origem_tipo = 'fiscal_nota' OR coalesce(p_cc_codigo, '') LIKE '1.1.5.%' THEN 'Mercadorias para revenda'
    WHEN coalesce(p_cc_codigo, '') LIKE '3.1.1.11.%' THEN 'Impostos e taxas'
    WHEN coalesce(p_cc_codigo, '') LIKE '3.1.1.02.%' THEN 'Pessoal'
    WHEN coalesce(p_cc_codigo, '') LIKE '3.2.%' THEN 'Despesas financeiras'
    WHEN nullif(trim(p_cc_descricao), '') IS NOT NULL THEN trim(p_cc_descricao)
    ELSE 'Outras despesas'
  END;
$$;

-- Chave do grupo econômico do cliente: CNPJ raiz (8 dígitos); CPF inteiro;
-- sem documento, o próprio cadastro.
CREATE OR REPLACE FUNCTION public._apr_grupo_cliente(p_doc text, p_cliente uuid)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN length(regexp_replace(coalesce(p_doc, ''), '\D', '', 'g')) = 14
      THEN left(regexp_replace(p_doc, '\D', '', 'g'), 8)
    WHEN length(regexp_replace(coalesce(p_doc, ''), '\D', '', 'g')) > 0
      THEN regexp_replace(p_doc, '\D', '', 'g')
    WHEN p_cliente IS NOT NULL THEN p_cliente::text
    ELSE 'sem-cliente'
  END;
$$;

CREATE OR REPLACE FUNCTION public.apresentacao_fechamento_dados(p_competencia text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
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
  pg AS (
    SELECT to_char(x.d, 'YYYY-MM') AS comp, x.v, x.cat, x.forn FROM (
      SELECT b.data_baixa AS d, b.valor_pago AS v,
             _apr_categoria_despesa(fl.origem_tabela, fl.origem_tipo, fl.cartao_fatura_id, cc.codigo, cc.descricao) AS cat,
             coalesce(nullif(trim(f.nome_fantasia), ''), nullif(trim(f.nome_razao_social), '')) AS forn
        FROM financeiro_baixas b
        JOIN financeiro_lancamentos fl ON fl.id = b.lancamento_id
        LEFT JOIN contas_contabeis cc ON cc.id = fl.conta_contabil_id
        LEFT JOIN fornecedores f ON f.id = fl.fornecedor_id
       WHERE fl.empresa_id = v_emp AND fl.tipo = 'pagar' AND fl.status <> 'cancelado'
         AND b.estornada_em IS NULL AND b.data_baixa BETWEEN v_ini AND v_fim
         AND coalesce(cc.codigo, '') NOT LIKE '1.1.1.%'
      UNION ALL
      SELECT fl.data_pagamento, fl.valor_pago,
             _apr_categoria_despesa(fl.origem_tabela, fl.origem_tipo, fl.cartao_fatura_id, cc.codigo, cc.descricao),
             coalesce(nullif(trim(f.nome_fantasia), ''), nullif(trim(f.nome_razao_social), ''))
        FROM financeiro_lancamentos fl
        LEFT JOIN contas_contabeis cc ON cc.id = fl.conta_contabil_id
        LEFT JOIN fornecedores f ON f.id = fl.fornecedor_id
       WHERE fl.empresa_id = v_emp AND fl.tipo = 'pagar' AND fl.status = 'pago'
         AND fl.data_pagamento BETWEEN v_ini AND v_fim
         AND NOT EXISTS (SELECT 1 FROM financeiro_baixas b WHERE b.lancamento_id = fl.id AND b.estornada_em IS NULL)
         AND coalesce(cc.codigo, '') NOT LIKE '1.1.1.%'
    ) x
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
                            FROM (SELECT cat, round(sum(v), 2) AS v FROM pg WHERE pg.comp = meses.comp GROUP BY cat) a), '{}'::jsonb),
    'fornecedores', coalesce((SELECT jsonb_agg(jsonb_build_object('nome', forn, 'v', v) ORDER BY v DESC)
                                FROM (SELECT forn, round(sum(v), 2) AS v FROM pg
                                       WHERE pg.comp = meses.comp AND forn IS NOT NULL
                                       GROUP BY forn ORDER BY 2 DESC LIMIT 10) a), '[]'::jsonb)))
    INTO v_detalhe
    FROM meses;

  -- Nome do grupo: o cadastro com mais faturamento nos últimos 12 meses (ou no
  -- histórico, se não houver venda recente); primeira compra
  -- em todo o histórico de notas.
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
$$;

REVOKE ALL ON FUNCTION public._apr_categoria_despesa(text, text, uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._apr_grupo_cliente(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apresentacao_fechamento_dados(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apresentacao_fechamento_dados(text) TO authenticated;

-- Histórico de gerações no modelo novo.
ALTER TABLE public.apresentacao_geracoes ALTER COLUMN template_id DROP NOT NULL;
ALTER TABLE public.apresentacao_geracoes ADD COLUMN IF NOT EXISTS versao text;
ALTER TABLE public.apresentacao_geracoes ADD COLUMN IF NOT EXISTS competencia text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'apresentacao_geracoes_versao_check') THEN
    ALTER TABLE public.apresentacao_geracoes
      ADD CONSTRAINT apresentacao_geracoes_versao_check
      CHECK (versao IS NULL OR versao IN ('mensal', 'trimestral', 'anual'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'apresentacao_geracoes_competencia_check') THEN
    ALTER TABLE public.apresentacao_geracoes
      ADD CONSTRAINT apresentacao_geracoes_competencia_check
      CHECK (competencia IS NULL OR competencia ~ '^\d{4}-\d{2}$');
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_apresentacao_geracoes_competencia
  ON public.apresentacao_geracoes (competencia, versao);
