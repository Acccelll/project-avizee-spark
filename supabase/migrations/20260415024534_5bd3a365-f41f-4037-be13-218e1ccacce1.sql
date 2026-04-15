
-- 1. Add missing columns to orcamentos
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS transportadora_id UUID,
  ADD COLUMN IF NOT EXISTS frete_simulacao_id TEXT,
  ADD COLUMN IF NOT EXISTS origem_frete TEXT,
  ADD COLUMN IF NOT EXISTS servico_frete TEXT,
  ADD COLUMN IF NOT EXISTS prazo_entrega_dias INTEGER,
  ADD COLUMN IF NOT EXISTS volumes INTEGER,
  ADD COLUMN IF NOT EXISTS altura_cm NUMERIC,
  ADD COLUMN IF NOT EXISTS largura_cm NUMERIC,
  ADD COLUMN IF NOT EXISTS comprimento_cm NUMERIC;

-- 2. Create clientes_enderecos_entrega table
CREATE TABLE IF NOT EXISTS public.clientes_enderecos_entrega (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  descricao TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  cep TEXT,
  principal BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.clientes_enderecos_entrega ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cee_select" ON public.clientes_enderecos_entrega FOR SELECT TO authenticated USING (true);
CREATE POLICY "cee_insert" ON public.clientes_enderecos_entrega FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cee_update" ON public.clientes_enderecos_entrega FOR UPDATE TO authenticated USING (true);
CREATE POLICY "cee_delete" ON public.clientes_enderecos_entrega FOR DELETE TO authenticated USING (true);

-- 3. Fix pedidos_compra CHECK constraint to allow 'aprovado'
ALTER TABLE public.pedidos_compra DROP CONSTRAINT IF EXISTS chk_pedidos_compra_status;
ALTER TABLE public.pedidos_compra ADD CONSTRAINT chk_pedidos_compra_status
  CHECK (status IN ('rascunho','enviado','parcial','recebido','cancelado','aprovado'));
