-- ===================================================================
-- Migration: Ampliar cliente_registros_comunicacao
--            Adicionar retorno_previsto, status, e data_hora
-- ===================================================================

-- Adiciona campos que ainda não existem
ALTER TABLE public.cliente_registros_comunicacao
  ADD COLUMN IF NOT EXISTS retorno_previsto DATE,
  ADD COLUMN IF NOT EXISTS status           TEXT NOT NULL DEFAULT 'registrado',
  ADD COLUMN IF NOT EXISTS data_hora        TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS responsavel_nome TEXT;

-- Index para listagem do cliente
CREATE INDEX IF NOT EXISTS idx_cliente_reg_com_cliente_id
  ON public.cliente_registros_comunicacao (cliente_id, data_registro DESC);
