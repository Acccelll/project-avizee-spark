DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contas_contabeis_codigo_key') THEN
    ALTER TABLE public.contas_contabeis ADD CONSTRAINT contas_contabeis_codigo_key UNIQUE (codigo);
  END IF;
END $$;