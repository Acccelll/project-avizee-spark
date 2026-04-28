DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'nfe_distribuicao'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.nfe_distribuicao';
  END IF;
END $$;

ALTER TABLE public.nfe_distribuicao REPLICA IDENTITY FULL;