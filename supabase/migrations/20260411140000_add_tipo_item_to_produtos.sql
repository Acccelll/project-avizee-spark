-- Add tipo_item column to produtos table
-- Values: 'produto' (default) | 'insumo'
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS tipo_item TEXT NOT NULL DEFAULT 'produto';

-- Retrocompatibility: populate existing rows with default value
UPDATE public.produtos SET tipo_item = 'produto' WHERE tipo_item IS NULL OR tipo_item = '';

-- Add check constraint for valid values
ALTER TABLE public.produtos
  ADD CONSTRAINT produtos_tipo_item_check CHECK (tipo_item IN ('produto', 'insumo'));
