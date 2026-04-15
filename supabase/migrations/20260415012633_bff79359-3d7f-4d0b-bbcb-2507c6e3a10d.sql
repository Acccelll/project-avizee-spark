
-- 1. Add missing columns to cliente_registros_comunicacao
ALTER TABLE public.cliente_registros_comunicacao
  ADD COLUMN IF NOT EXISTS responsavel_nome TEXT,
  ADD COLUMN IF NOT EXISTS retorno_previsto DATE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'registrado',
  ADD COLUMN IF NOT EXISTS data_hora TIMESTAMPTZ;

-- 2. Add tipo_remessa to remessas
ALTER TABLE public.remessas
  ADD COLUMN IF NOT EXISTS tipo_remessa TEXT DEFAULT 'entrega';

-- 3. Add motivo_estorno to financeiro_lancamentos
ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS motivo_estorno TEXT;

-- 4. Update cotacoes_compra CHECK constraint to include 'convertida'
DO $$
BEGIN
  ALTER TABLE public.cotacoes_compra DROP CONSTRAINT IF EXISTS chk_cotacoes_compra_status;
  ALTER TABLE public.cotacoes_compra ADD CONSTRAINT chk_cotacoes_compra_status
    CHECK (status IN ('aberta','em_analise','aguardando_aprovacao','aprovada','finalizada','convertida','rejeitada','cancelada'));
EXCEPTION WHEN others THEN NULL;
END $$;
