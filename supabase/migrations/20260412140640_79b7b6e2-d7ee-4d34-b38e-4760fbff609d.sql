
-- Snapshot tables for closed-mode workbook generation

CREATE TABLE IF NOT EXISTS public.fechamento_financeiro_saldos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fechamento_id uuid REFERENCES public.fechamentos_mensais(id) ON DELETE CASCADE,
  tipo text NOT NULL, -- 'receber' or 'pagar'
  competencia text NOT NULL,
  saldo_total numeric NOT NULL DEFAULT 0,
  quantidade integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fechamento_financeiro_saldos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ffs_select" ON public.fechamento_financeiro_saldos FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "ffs_insert" ON public.fechamento_financeiro_saldos FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.fechamento_caixa_saldos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fechamento_id uuid REFERENCES public.fechamentos_mensais(id) ON DELETE CASCADE,
  conta_bancaria_id uuid REFERENCES public.contas_bancarias(id),
  competencia text NOT NULL,
  saldo numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fechamento_caixa_saldos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fcs_select" ON public.fechamento_caixa_saldos FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "fcs_insert" ON public.fechamento_caixa_saldos FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.fechamento_estoque_saldos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fechamento_id uuid REFERENCES public.fechamentos_mensais(id) ON DELETE CASCADE,
  produto_id uuid REFERENCES public.produtos(id),
  competencia text NOT NULL,
  quantidade numeric NOT NULL DEFAULT 0,
  valor_custo numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fechamento_estoque_saldos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fes_select" ON public.fechamento_estoque_saldos FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "fes_insert" ON public.fechamento_estoque_saldos FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.fechamento_fopag_resumo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fechamento_id uuid REFERENCES public.fechamentos_mensais(id) ON DELETE CASCADE,
  funcionario_id uuid REFERENCES public.funcionarios(id),
  competencia text NOT NULL,
  salario_base numeric NOT NULL DEFAULT 0,
  proventos numeric NOT NULL DEFAULT 0,
  descontos numeric NOT NULL DEFAULT 0,
  valor_liquido numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fechamento_fopag_resumo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ffr_select" ON public.fechamento_fopag_resumo FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "ffr_insert" ON public.fechamento_fopag_resumo FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Analytical views for workbook generation

CREATE OR REPLACE VIEW public.vw_workbook_receita_mensal AS
SELECT
  to_char(data_vencimento, 'YYYY-MM') AS competencia,
  SUM(valor) AS total_receita,
  SUM(COALESCE(valor_pago, 0)) AS total_recebido,
  COUNT(*) AS quantidade
FROM public.financeiro_lancamentos
WHERE tipo = 'receber' AND ativo = true
GROUP BY to_char(data_vencimento, 'YYYY-MM');

CREATE OR REPLACE VIEW public.vw_workbook_despesa_mensal AS
SELECT
  to_char(data_vencimento, 'YYYY-MM') AS competencia,
  SUM(valor) AS total_despesa,
  SUM(COALESCE(valor_pago, 0)) AS total_pago,
  COUNT(*) AS quantidade
FROM public.financeiro_lancamentos
WHERE tipo = 'pagar' AND ativo = true
GROUP BY to_char(data_vencimento, 'YYYY-MM');

CREATE OR REPLACE VIEW public.vw_workbook_faturamento_mensal AS
SELECT
  to_char(data_emissao, 'YYYY-MM') AS competencia,
  SUM(COALESCE(valor_total, 0)) AS total_faturado,
  COUNT(*) AS quantidade_nfs
FROM public.notas_fiscais
WHERE ativo = true AND tipo = 'saida' AND status NOT IN ('cancelada', 'inutilizada')
GROUP BY to_char(data_emissao, 'YYYY-MM');

CREATE OR REPLACE VIEW public.vw_workbook_estoque_posicao AS
SELECT
  p.id AS produto_id,
  p.nome,
  p.sku,
  COALESCE(p.estoque_atual, 0) AS quantidade,
  COALESCE(p.preco_custo, 0) AS custo_unitario,
  COALESCE(p.estoque_atual, 0) * COALESCE(p.preco_custo, 0) AS valor_total,
  p.grupo_id,
  COALESCE(g.nome, 'Sem Grupo') AS grupo_nome
FROM public.produtos p
LEFT JOIN public.grupos_produto g ON g.id = p.grupo_id
WHERE p.ativo = true;

CREATE OR REPLACE VIEW public.vw_workbook_bancos_saldo AS
SELECT
  cb.id,
  cb.descricao,
  COALESCE(cb.saldo_atual, 0) AS saldo_atual,
  cb.agencia,
  cb.conta,
  COALESCE(b.nome, '') AS banco_nome
FROM public.contas_bancarias cb
LEFT JOIN public.bancos b ON b.id = cb.banco_id
WHERE cb.ativo = true;

CREATE OR REPLACE VIEW public.vw_workbook_aging_cr AS
SELECT
  fl.id,
  fl.data_vencimento,
  fl.valor,
  COALESCE(fl.valor_pago, 0) AS valor_pago,
  COALESCE(fl.saldo_restante, fl.valor - COALESCE(fl.valor_pago, 0)) AS saldo_aberto,
  fl.status,
  fl.cliente_id,
  fl.descricao
FROM public.financeiro_lancamentos fl
WHERE fl.tipo = 'receber' AND fl.ativo = true AND COALESCE(fl.status, 'aberto') != 'pago';

CREATE OR REPLACE VIEW public.vw_workbook_aging_cp AS
SELECT
  fl.id,
  fl.data_vencimento,
  fl.valor,
  COALESCE(fl.valor_pago, 0) AS valor_pago,
  COALESCE(fl.saldo_restante, fl.valor - COALESCE(fl.valor_pago, 0)) AS saldo_aberto,
  fl.status,
  fl.fornecedor_id,
  fl.descricao
FROM public.financeiro_lancamentos fl
WHERE fl.tipo = 'pagar' AND fl.ativo = true AND COALESCE(fl.status, 'aberto') != 'pago';
