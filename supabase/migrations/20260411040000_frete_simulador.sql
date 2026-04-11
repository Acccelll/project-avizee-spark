-- =============================================================
-- FRETE SIMULADOR
-- Cria as tabelas de simulação de frete e evolui orcamentos,
-- ordens_venda e remessas sem quebrar compatibilidade.
-- =============================================================

-- -------------------------------------------------------------
-- 1. frete_simulacoes
-- -------------------------------------------------------------
CREATE TABLE public.frete_simulacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem_tipo text NOT NULL CHECK (origem_tipo IN ('orcamento', 'pedido')),
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

ALTER TABLE public.frete_simulacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fs_select" ON public.frete_simulacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "fs_insert" ON public.frete_simulacoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fs_update" ON public.frete_simulacoes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "fs_delete" ON public.frete_simulacoes FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_frete_simulacoes_updated_at
  BEFORE UPDATE ON public.frete_simulacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_frete_simulacoes_origem ON public.frete_simulacoes(origem_tipo, origem_id);
CREATE INDEX idx_frete_simulacoes_cliente ON public.frete_simulacoes(cliente_id);

-- -------------------------------------------------------------
-- 2. frete_simulacoes_opcoes
-- -------------------------------------------------------------
CREATE TABLE public.frete_simulacoes_opcoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulacao_id uuid NOT NULL REFERENCES public.frete_simulacoes(id) ON DELETE CASCADE,
  transportadora_id uuid NULL REFERENCES public.transportadoras(id),
  fonte text NOT NULL CHECK (fonte IN ('correios', 'cliente_vinculada', 'manual')),
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

ALTER TABLE public.frete_simulacoes_opcoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fso_select" ON public.frete_simulacoes_opcoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "fso_insert" ON public.frete_simulacoes_opcoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fso_update" ON public.frete_simulacoes_opcoes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "fso_delete" ON public.frete_simulacoes_opcoes FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_fso_simulacao ON public.frete_simulacoes_opcoes(simulacao_id);

-- Self-referential FK added after opcoes table exists
ALTER TABLE public.frete_simulacoes
  ADD CONSTRAINT frete_simulacoes_opcao_escolhida_fkey
  FOREIGN KEY (opcao_escolhida_id) REFERENCES public.frete_simulacoes_opcoes(id);

-- -------------------------------------------------------------
-- 3. Evolve orcamentos
-- -------------------------------------------------------------
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS transportadora_id uuid NULL REFERENCES public.transportadoras(id),
  ADD COLUMN IF NOT EXISTS frete_simulacao_id uuid NULL REFERENCES public.frete_simulacoes(id),
  ADD COLUMN IF NOT EXISTS origem_frete text NULL CHECK (origem_frete IN ('correios', 'cliente_vinculada', 'manual')),
  ADD COLUMN IF NOT EXISTS servico_frete text NULL,
  ADD COLUMN IF NOT EXISTS prazo_entrega_dias integer NULL,
  ADD COLUMN IF NOT EXISTS volumes integer NULL,
  ADD COLUMN IF NOT EXISTS altura_cm numeric NULL,
  ADD COLUMN IF NOT EXISTS largura_cm numeric NULL,
  ADD COLUMN IF NOT EXISTS comprimento_cm numeric NULL;

CREATE INDEX IF NOT EXISTS idx_orcamentos_simulacao ON public.orcamentos(frete_simulacao_id);

-- -------------------------------------------------------------
-- 4. Evolve ordens_venda
-- -------------------------------------------------------------
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

-- -------------------------------------------------------------
-- 5. Evolve remessas
-- -------------------------------------------------------------
ALTER TABLE public.remessas
  ADD COLUMN IF NOT EXISTS frete_simulacao_id uuid NULL REFERENCES public.frete_simulacoes(id);
