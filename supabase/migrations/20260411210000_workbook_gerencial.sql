-- workbook_templates
CREATE TABLE IF NOT EXISTS workbook_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  codigo text UNIQUE NOT NULL,
  versao text NOT NULL DEFAULT '1.0',
  arquivo_path text NOT NULL DEFAULT 'templates/workbook_gerencial_v1.xlsx',
  estrutura_json jsonb NULL,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE workbook_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_authenticated" ON workbook_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- workbook_geracoes
CREATE TABLE IF NOT EXISTS workbook_geracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES workbook_templates(id),
  empresa_id uuid NULL,
  competencia_inicial date NULL,
  competencia_final date NULL,
  modo_geracao text CHECK (modo_geracao IN ('dinamico','fechado')),
  fechamento_id_inicial uuid NULL,
  fechamento_id_final uuid NULL,
  status text CHECK (status IN ('pendente','gerando','concluido','erro')) DEFAULT 'pendente',
  arquivo_path text NULL,
  hash_geracao text NULL,
  parametros_json jsonb NULL,
  observacoes text NULL,
  gerado_por uuid NULL,
  gerado_em timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE workbook_geracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_authenticated" ON workbook_geracoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_workbook_geracoes_template_id ON workbook_geracoes(template_id);

-- fechamentos_mensais
CREATE TABLE IF NOT EXISTS fechamentos_mensais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NULL,
  competencia date NOT NULL,
  status text CHECK (status IN ('aberto','fechado')) DEFAULT 'aberto',
  fechado_em timestamptz NULL,
  fechado_por uuid NULL,
  observacoes text NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(empresa_id, competencia)
);

ALTER TABLE fechamentos_mensais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_authenticated" ON fechamentos_mensais FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- fechamento_financeiro_saldos
CREATE TABLE IF NOT EXISTS fechamento_financeiro_saldos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fechamento_id uuid NOT NULL REFERENCES fechamentos_mensais(id),
  tipo text NOT NULL,
  parceiro_tipo text NULL,
  parceiro_id uuid NULL,
  conta_contabil_id uuid NULL,
  conta_bancaria_id uuid NULL,
  data_vencimento date NULL,
  valor_original numeric(18,2) NOT NULL DEFAULT 0,
  valor_pago numeric(18,2) NOT NULL DEFAULT 0,
  saldo_aberto numeric(18,2) NOT NULL DEFAULT 0,
  faixa_aging text NULL,
  status text NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE fechamento_financeiro_saldos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_authenticated" ON fechamento_financeiro_saldos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_fechamento_financeiro_saldos_fechamento_id ON fechamento_financeiro_saldos(fechamento_id);

-- fechamento_caixa_saldos
CREATE TABLE IF NOT EXISTS fechamento_caixa_saldos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fechamento_id uuid NOT NULL REFERENCES fechamentos_mensais(id),
  conta_bancaria_id uuid NULL,
  saldo_final numeric(18,2) NOT NULL DEFAULT 0,
  total_entradas numeric(18,2) NOT NULL DEFAULT 0,
  total_saidas numeric(18,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE fechamento_caixa_saldos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_authenticated" ON fechamento_caixa_saldos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_fechamento_caixa_saldos_fechamento_id ON fechamento_caixa_saldos(fechamento_id);

-- fechamento_estoque_saldos
CREATE TABLE IF NOT EXISTS fechamento_estoque_saldos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fechamento_id uuid NOT NULL REFERENCES fechamentos_mensais(id),
  produto_id uuid NOT NULL,
  quantidade numeric(18,4) NOT NULL DEFAULT 0,
  custo_unitario numeric(18,6) NOT NULL DEFAULT 0,
  valor_total numeric(18,2) NOT NULL DEFAULT 0,
  grupo_id uuid NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE fechamento_estoque_saldos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_authenticated" ON fechamento_estoque_saldos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_fechamento_estoque_saldos_fechamento_id ON fechamento_estoque_saldos(fechamento_id);

-- fechamento_fopag_resumo
CREATE TABLE IF NOT EXISTS fechamento_fopag_resumo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fechamento_id uuid NOT NULL REFERENCES fechamentos_mensais(id),
  funcionario_id uuid NULL,
  competencia date NOT NULL,
  salario_base numeric(18,2) NOT NULL DEFAULT 0,
  proventos numeric(18,2) NOT NULL DEFAULT 0,
  descontos numeric(18,2) NOT NULL DEFAULT 0,
  valor_liquido numeric(18,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE fechamento_fopag_resumo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_authenticated" ON fechamento_fopag_resumo FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_fechamento_fopag_resumo_fechamento_id ON fechamento_fopag_resumo(fechamento_id);

-- mapeamento_gerencial_contas
CREATE TABLE IF NOT EXISTS mapeamento_gerencial_contas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_contabil_id uuid NOT NULL,
  linha_gerencial text NULL,
  linha_dre text NULL,
  grupo_resultado_financeiro text NULL,
  grupo_fluxo_caixa text NULL,
  grupo_capital_giro text NULL,
  grupo_aging text NULL,
  grupo_tributo text NULL,
  grupo_banco text NULL,
  grupo_debt text NULL,
  sinal_padrao smallint NULL DEFAULT 1,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE mapeamento_gerencial_contas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_authenticated" ON mapeamento_gerencial_contas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Default template
INSERT INTO workbook_templates (nome, codigo, versao, arquivo_path)
VALUES ('Workbook Gerencial V1', 'WORKBOOK_GERENCIAL_V1', '1.0', 'templates/workbook_gerencial_v1.xlsx')
ON CONFLICT (codigo) DO NOTHING;

-- Views
CREATE OR REPLACE VIEW vw_workbook_receita_mensal AS
SELECT
  date_trunc('month', fl.data_vencimento::timestamp)::date AS competencia,
  COALESCE(fl.conta_contabil_id::text, 'sem_conta') AS conta_contabil_id,
  COALESCE(cc.descricao, 'Sem Classificação') AS conta_descricao,
  SUM(fl.valor) AS valor_bruto,
  SUM(COALESCE(fl.valor_pago, 0)) AS valor_recebido,
  COUNT(*) AS qtd_lancamentos
FROM financeiro_lancamentos fl
LEFT JOIN contas_contabeis cc ON cc.id = fl.conta_contabil_id
WHERE fl.tipo = 'receber' AND fl.ativo = true
GROUP BY 1, 2, 3;

CREATE OR REPLACE VIEW vw_workbook_despesa_mensal AS
SELECT
  date_trunc('month', fl.data_vencimento::timestamp)::date AS competencia,
  COALESCE(fl.conta_contabil_id::text, 'sem_conta') AS conta_contabil_id,
  COALESCE(cc.descricao, 'Sem Classificação') AS conta_descricao,
  SUM(fl.valor) AS valor_bruto,
  SUM(COALESCE(fl.valor_pago, 0)) AS valor_pago,
  COUNT(*) AS qtd_lancamentos
FROM financeiro_lancamentos fl
LEFT JOIN contas_contabeis cc ON cc.id = fl.conta_contabil_id
WHERE fl.tipo = 'pagar' AND fl.ativo = true
GROUP BY 1, 2, 3;

CREATE OR REPLACE VIEW vw_workbook_resultado_financeiro AS
SELECT
  date_trunc('month', fl.data_vencimento::timestamp)::date AS competencia,
  fl.tipo,
  SUM(fl.valor) AS valor_total,
  SUM(COALESCE(fl.valor_pago, 0)) AS valor_realizado
FROM financeiro_lancamentos fl
WHERE fl.ativo = true
GROUP BY 1, 2;

CREATE OR REPLACE VIEW vw_workbook_fluxo_caixa AS
SELECT
  date_trunc('month', cm.created_at)::date AS competencia,
  cm.conta_bancaria_id,
  COALESCE(cb.descricao, 'Caixa Geral') AS conta_descricao,
  cm.tipo,
  SUM(cm.valor) AS total_valor,
  COUNT(*) AS qtd_movimentos
FROM caixa_movimentos cm
LEFT JOIN contas_bancarias cb ON cb.id = cm.conta_bancaria_id
GROUP BY 1, 2, 3, 4;

CREATE OR REPLACE VIEW vw_workbook_aging_cr AS
SELECT
  fl.id,
  fl.data_vencimento,
  fl.valor,
  COALESCE(fl.valor_pago, 0) AS valor_pago,
  COALESCE(fl.saldo_restante, fl.valor - COALESCE(fl.valor_pago, 0)) AS saldo_aberto,
  fl.status,
  fl.cliente_id,
  CASE
    WHEN fl.status = 'pago' THEN 'pago'
    WHEN fl.data_vencimento::date >= CURRENT_DATE THEN 'a_vencer'
    WHEN (CURRENT_DATE - fl.data_vencimento::date) BETWEEN 1 AND 30 THEN '1_30'
    WHEN (CURRENT_DATE - fl.data_vencimento::date) BETWEEN 31 AND 60 THEN '31_60'
    WHEN (CURRENT_DATE - fl.data_vencimento::date) BETWEEN 61 AND 90 THEN '61_90'
    ELSE 'acima_90'
  END AS faixa_aging
FROM financeiro_lancamentos fl
WHERE fl.tipo = 'receber' AND fl.ativo = true AND fl.status != 'pago';

CREATE OR REPLACE VIEW vw_workbook_aging_cp AS
SELECT
  fl.id,
  fl.data_vencimento,
  fl.valor,
  COALESCE(fl.valor_pago, 0) AS valor_pago,
  COALESCE(fl.saldo_restante, fl.valor - COALESCE(fl.valor_pago, 0)) AS saldo_aberto,
  fl.status,
  fl.fornecedor_id,
  CASE
    WHEN fl.status = 'pago' THEN 'pago'
    WHEN fl.data_vencimento::date >= CURRENT_DATE THEN 'a_vencer'
    WHEN (CURRENT_DATE - fl.data_vencimento::date) BETWEEN 1 AND 30 THEN '1_30'
    WHEN (CURRENT_DATE - fl.data_vencimento::date) BETWEEN 31 AND 60 THEN '31_60'
    WHEN (CURRENT_DATE - fl.data_vencimento::date) BETWEEN 61 AND 90 THEN '61_90'
    ELSE 'acima_90'
  END AS faixa_aging
FROM financeiro_lancamentos fl
WHERE fl.tipo = 'pagar' AND fl.ativo = true AND fl.status != 'pago';

CREATE OR REPLACE VIEW vw_workbook_estoque AS
SELECT
  p.id AS produto_id,
  p.nome,
  p.sku,
  p.estoque_atual AS quantidade,
  COALESCE(p.preco_custo, 0) AS custo_unitario,
  COALESCE(p.estoque_atual, 0) * COALESCE(p.preco_custo, 0) AS valor_total,
  p.grupo_id,
  gp.descricao AS grupo_descricao
FROM produtos p
LEFT JOIN grupos_produto gp ON gp.id = p.grupo_id
WHERE p.ativo = true;

CREATE OR REPLACE VIEW vw_workbook_fopag AS
SELECT
  fp.id,
  fp.competencia,
  fp.funcionario_id,
  f.nome AS funcionario_nome,
  f.cargo,
  f.departamento,
  fp.salario_base,
  COALESCE(fp.proventos, 0) AS proventos,
  COALESCE(fp.descontos, 0) AS descontos,
  COALESCE(fp.valor_liquido, 0) AS valor_liquido,
  fp.status
FROM folha_pagamento fp
LEFT JOIN funcionarios f ON f.id = fp.funcionario_id;

CREATE OR REPLACE VIEW vw_workbook_bancos AS
SELECT
  cb.id,
  cb.descricao,
  cb.agencia,
  cb.conta,
  COALESCE(cb.saldo_atual, 0) AS saldo_atual,
  cb.ativo,
  b.nome AS banco_nome
FROM contas_bancarias cb
LEFT JOIN bancos b ON b.id = cb.banco_id
WHERE cb.ativo = true;

CREATE OR REPLACE VIEW vw_workbook_confronto_receita_caixa AS
SELECT
  date_trunc('month', fl.data_vencimento::timestamp)::date AS competencia,
  SUM(CASE WHEN fl.tipo = 'receber' THEN fl.valor ELSE 0 END) AS receita_prevista,
  SUM(CASE WHEN fl.tipo = 'receber' THEN COALESCE(fl.valor_pago, 0) ELSE 0 END) AS receita_realizada,
  SUM(CASE WHEN fl.tipo = 'receber' THEN COALESCE(fl.valor_pago, 0) ELSE 0 END) /
    NULLIF(SUM(CASE WHEN fl.tipo = 'receber' THEN fl.valor ELSE 0 END), 0) * 100 AS pct_realizacao
FROM financeiro_lancamentos fl
WHERE fl.ativo = true
GROUP BY 1;
