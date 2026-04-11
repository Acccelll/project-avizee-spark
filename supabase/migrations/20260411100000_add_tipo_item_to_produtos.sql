ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS tipo_item text;

UPDATE public.produtos
SET tipo_item = 'produto'
WHERE tipo_item IS NULL
   OR tipo_item NOT IN ('produto', 'insumo');

ALTER TABLE public.produtos
  ALTER COLUMN tipo_item SET DEFAULT 'produto',
  ALTER COLUMN tipo_item SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'produtos_tipo_item_check'
      AND conrelid = 'public.produtos'::regclass
  ) THEN
    ALTER TABLE public.produtos
      ADD CONSTRAINT produtos_tipo_item_check
      CHECK (tipo_item IN ('produto', 'insumo'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_produtos_tipo_item ON public.produtos(tipo_item);
