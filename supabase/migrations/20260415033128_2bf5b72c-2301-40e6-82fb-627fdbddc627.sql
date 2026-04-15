
-- 1. Add missing columns to clientes_enderecos_entrega
ALTER TABLE public.clientes_enderecos_entrega
  ADD COLUMN IF NOT EXISTS contato TEXT,
  ADD COLUMN IF NOT EXISTS telefone TEXT,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS identificacao TEXT DEFAULT 'Endereço de Entrega';

-- 2. Create frete_simulacoes table
CREATE TABLE IF NOT EXISTS public.frete_simulacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origem_tipo TEXT NOT NULL DEFAULT 'orcamento',
  origem_id UUID NOT NULL,
  cliente_id UUID,
  cep_origem TEXT,
  cep_destino TEXT,
  peso_total NUMERIC,
  valor_mercadoria NUMERIC,
  volumes INTEGER DEFAULT 1,
  altura_cm NUMERIC,
  largura_cm NUMERIC,
  comprimento_cm NUMERIC,
  opcao_escolhida_id UUID,
  status TEXT DEFAULT 'rascunho',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.frete_simulacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "frete_sim_select" ON public.frete_simulacoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "frete_sim_insert" ON public.frete_simulacoes
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "frete_sim_update" ON public.frete_simulacoes
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "frete_sim_delete" ON public.frete_simulacoes
  FOR DELETE TO authenticated USING (true);

-- 3. Create frete_simulacoes_opcoes table
CREATE TABLE IF NOT EXISTS public.frete_simulacoes_opcoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulacao_id UUID NOT NULL REFERENCES public.frete_simulacoes(id) ON DELETE CASCADE,
  transportadora_id UUID,
  fonte TEXT NOT NULL DEFAULT 'manual',
  servico TEXT,
  codigo TEXT,
  modalidade TEXT,
  prazo_dias INTEGER,
  valor_frete NUMERIC DEFAULT 0,
  valor_adicional NUMERIC DEFAULT 0,
  valor_total NUMERIC DEFAULT 0,
  selecionada BOOLEAN DEFAULT false,
  observacoes TEXT,
  payload_raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.frete_simulacoes_opcoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "frete_opc_select" ON public.frete_simulacoes_opcoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "frete_opc_insert" ON public.frete_simulacoes_opcoes
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "frete_opc_update" ON public.frete_simulacoes_opcoes
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "frete_opc_delete" ON public.frete_simulacoes_opcoes
  FOR DELETE TO authenticated USING (true);
