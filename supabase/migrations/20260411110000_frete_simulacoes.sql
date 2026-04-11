-- Simulador de frete em orçamentos/pedidos

CREATE TABLE IF NOT EXISTS public.frete_simulacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem_tipo text NOT NULL CHECK (origem_tipo IN ('orcamento','pedido')),
  origem_id uuid NOT NULL,
  cliente_id uuid NULL REFERENCES public.clientes(id),
  cep_origem text NULL,
  cep_destino text NULL,
  peso_total numeric NULL,
  volumes integer NULL DEFAULT 1,
  altura_cm numeric NULL,
  largura_cm numeric NULL,
  comprimento_cm numeric NULL,
  valor_mercadoria numeric NULL,
  status text NOT NULL DEFAULT 'rascunho',
  opcao_escolhida_id uuid NULL,
  observacoes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.frete_simulacoes_opcoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulacao_id uuid NOT NULL REFERENCES public.frete_simulacoes(id) ON DELETE CASCADE,
  transportadora_id uuid NULL REFERENCES public.transportadoras(id),
  fonte text NOT NULL CHECK (fonte IN ('correios','cliente_vinculada','manual')),
  servico text NULL,
  codigo text NULL,
  modalidade text NULL,
  prazo_dias integer NULL,
  valor_frete numeric NOT NULL DEFAULT 0,
  valor_adicional numeric NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  selecionada boolean NOT NULL DEFAULT false,
  payload_raw jsonb NULL,
  observacoes text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.frete_simulacoes
  ADD CONSTRAINT frete_simulacoes_opcao_escolhida_fkey
  FOREIGN KEY (opcao_escolhida_id) REFERENCES public.frete_simulacoes_opcoes(id) ON DELETE SET NULL;

ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS transportadora_id uuid NULL REFERENCES public.transportadoras(id),
  ADD COLUMN IF NOT EXISTS frete_simulacao_id uuid NULL REFERENCES public.frete_simulacoes(id),
  ADD COLUMN IF NOT EXISTS origem_frete text NULL CHECK (origem_frete IN ('correios','cliente_vinculada','manual')),
  ADD COLUMN IF NOT EXISTS servico_frete text NULL,
  ADD COLUMN IF NOT EXISTS prazo_entrega_dias integer NULL,
  ADD COLUMN IF NOT EXISTS volumes integer NULL,
  ADD COLUMN IF NOT EXISTS altura_cm numeric NULL,
  ADD COLUMN IF NOT EXISTS largura_cm numeric NULL,
  ADD COLUMN IF NOT EXISTS comprimento_cm numeric NULL;

ALTER TABLE public.ordens_venda
  ADD COLUMN IF NOT EXISTS transportadora_id uuid NULL REFERENCES public.transportadoras(id),
  ADD COLUMN IF NOT EXISTS frete_simulacao_id uuid NULL REFERENCES public.frete_simulacoes(id),
  ADD COLUMN IF NOT EXISTS origem_frete text NULL,
  ADD COLUMN IF NOT EXISTS servico_frete text NULL,
  ADD COLUMN IF NOT EXISTS frete_valor numeric NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS frete_tipo text NULL,
  ADD COLUMN IF NOT EXISTS modalidade text NULL,
  ADD COLUMN IF NOT EXISTS peso_total numeric NULL,
  ADD COLUMN IF NOT EXISTS prazo_entrega_dias integer NULL,
  ADD COLUMN IF NOT EXISTS volumes integer NULL;

ALTER TABLE public.remessas
  ADD COLUMN IF NOT EXISTS frete_simulacao_id uuid NULL REFERENCES public.frete_simulacoes(id);

CREATE INDEX IF NOT EXISTS idx_frete_simulacoes_origem ON public.frete_simulacoes(origem_tipo, origem_id);
CREATE INDEX IF NOT EXISTS idx_frete_simulacoes_cliente ON public.frete_simulacoes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_frete_simulacoes_opcoes_simulacao ON public.frete_simulacoes_opcoes(simulacao_id);
CREATE INDEX IF NOT EXISTS idx_frete_simulacoes_opcoes_fonte ON public.frete_simulacoes_opcoes(fonte);
CREATE INDEX IF NOT EXISTS idx_orcamentos_frete_simulacao ON public.orcamentos(frete_simulacao_id);
CREATE INDEX IF NOT EXISTS idx_ordens_venda_frete_simulacao ON public.ordens_venda(frete_simulacao_id);
CREATE INDEX IF NOT EXISTS idx_remessas_frete_simulacao ON public.remessas(frete_simulacao_id);

DROP TRIGGER IF EXISTS trg_frete_simulacoes_updated_at ON public.frete_simulacoes;
CREATE TRIGGER trg_frete_simulacoes_updated_at
BEFORE UPDATE ON public.frete_simulacoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.frete_simulacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frete_simulacoes_opcoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS frete_simulacoes_select ON public.frete_simulacoes;
DROP POLICY IF EXISTS frete_simulacoes_insert ON public.frete_simulacoes;
DROP POLICY IF EXISTS frete_simulacoes_update ON public.frete_simulacoes;
DROP POLICY IF EXISTS frete_simulacoes_delete ON public.frete_simulacoes;
CREATE POLICY frete_simulacoes_select ON public.frete_simulacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY frete_simulacoes_insert ON public.frete_simulacoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY frete_simulacoes_update ON public.frete_simulacoes FOR UPDATE TO authenticated USING (true);
CREATE POLICY frete_simulacoes_delete ON public.frete_simulacoes FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS frete_simulacoes_opcoes_select ON public.frete_simulacoes_opcoes;
DROP POLICY IF EXISTS frete_simulacoes_opcoes_insert ON public.frete_simulacoes_opcoes;
DROP POLICY IF EXISTS frete_simulacoes_opcoes_update ON public.frete_simulacoes_opcoes;
DROP POLICY IF EXISTS frete_simulacoes_opcoes_delete ON public.frete_simulacoes_opcoes;
CREATE POLICY frete_simulacoes_opcoes_select ON public.frete_simulacoes_opcoes FOR SELECT TO authenticated USING (true);
CREATE POLICY frete_simulacoes_opcoes_insert ON public.frete_simulacoes_opcoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY frete_simulacoes_opcoes_update ON public.frete_simulacoes_opcoes FOR UPDATE TO authenticated USING (true);
CREATE POLICY frete_simulacoes_opcoes_delete ON public.frete_simulacoes_opcoes FOR DELETE TO authenticated USING (true);
