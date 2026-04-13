-- ===================================================================
-- Migration: Múltiplos Endereços de Entrega para Clientes
-- ===================================================================

CREATE TABLE IF NOT EXISTS public.clientes_enderecos_entrega (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id     UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  identificacao  TEXT NOT NULL DEFAULT 'Endereço de Entrega',
  logradouro     TEXT,
  numero         TEXT,
  complemento    TEXT,
  bairro         TEXT,
  cidade         TEXT,
  uf             TEXT,
  cep            TEXT,
  contato        TEXT,
  telefone       TEXT,
  principal      BOOLEAN NOT NULL DEFAULT FALSE,
  ativo          BOOLEAN NOT NULL DEFAULT TRUE,
  observacoes    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_clientes_enderecos_entrega_updated_at ON public.clientes_enderecos_entrega;
CREATE TRIGGER trg_clientes_enderecos_entrega_updated_at
  BEFORE UPDATE ON public.clientes_enderecos_entrega
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Index por cliente
CREATE INDEX IF NOT EXISTS clientes_enderecos_entrega_cliente_id_idx
  ON public.clientes_enderecos_entrega (cliente_id);

-- RLS
ALTER TABLE public.clientes_enderecos_entrega ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clientes_enderecos_entrega_select" ON public.clientes_enderecos_entrega;
CREATE POLICY "clientes_enderecos_entrega_select"
  ON public.clientes_enderecos_entrega FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "clientes_enderecos_entrega_all_authenticated" ON public.clientes_enderecos_entrega;
CREATE POLICY "clientes_enderecos_entrega_all_authenticated"
  ON public.clientes_enderecos_entrega FOR ALL
  USING (auth.role() = 'authenticated');
