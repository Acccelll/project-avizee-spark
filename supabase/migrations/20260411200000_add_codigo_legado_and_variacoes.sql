-- ===================================================================
-- Migration: Add codigo_legado to clientes, fornecedores, produtos
--            Add variacoes JSONB to produtos
--            Add UNIQUE constraint on produtos.codigo_interno
-- ===================================================================

-- 1. clientes.codigo_legado
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS codigo_legado TEXT;

-- Unique per tabela (chave do sistema legado)
CREATE UNIQUE INDEX IF NOT EXISTS clientes_codigo_legado_unique
  ON public.clientes (codigo_legado)
  WHERE codigo_legado IS NOT NULL;

-- 2. fornecedores.codigo_legado
ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS codigo_legado TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS fornecedores_codigo_legado_unique
  ON public.fornecedores (codigo_legado)
  WHERE codigo_legado IS NOT NULL;

-- 3. produtos.codigo_legado
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS codigo_legado TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS produtos_codigo_legado_unique
  ON public.produtos (codigo_legado)
  WHERE codigo_legado IS NOT NULL;

-- 4. produtos.variacoes (JSONB para variações como cor, tamanho, etc.)
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS variacoes JSONB;

-- 5. UNIQUE constraint on produtos.codigo_interno (needed for upsert)
CREATE UNIQUE INDEX IF NOT EXISTS produtos_codigo_interno_unique
  ON public.produtos (codigo_interno)
  WHERE codigo_interno IS NOT NULL AND codigo_interno <> '';
