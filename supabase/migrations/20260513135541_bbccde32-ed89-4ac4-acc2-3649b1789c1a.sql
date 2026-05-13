ALTER TABLE public.produtos DROP CONSTRAINT IF EXISTS chk_produtos_codigo_interno_formato;
ALTER TABLE public.produtos ADD CONSTRAINT chk_produtos_codigo_interno_formato
  CHECK (codigo_interno ~ '^(PRD|INS|SRV)[0-9]{6}$');