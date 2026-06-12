ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS variacoes_text text;

CREATE OR REPLACE FUNCTION public.produtos_sync_variacoes_text()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.variacoes_text := COALESCE(array_to_string(NEW.variacoes, ' | '), '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_produtos_sync_variacoes_text ON public.produtos;
CREATE TRIGGER trg_produtos_sync_variacoes_text
BEFORE INSERT OR UPDATE OF variacoes ON public.produtos
FOR EACH ROW EXECUTE FUNCTION public.produtos_sync_variacoes_text();

UPDATE public.produtos
   SET variacoes_text = COALESCE(array_to_string(variacoes, ' | '), '')
 WHERE variacoes IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_produtos_variacoes_text_trgm
  ON public.produtos USING gin (variacoes_text gin_trgm_ops);