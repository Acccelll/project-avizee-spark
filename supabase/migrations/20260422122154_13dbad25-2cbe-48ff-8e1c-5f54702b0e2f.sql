-- Adiciona ordens_venda e notas_fiscais à publicação supabase_realtime
-- para que o canal `comercial-shared` (frontend) receba eventos de mudança
-- e invalide queries React Query automaticamente após RPCs (faturar pedido,
-- confirmar/estornar NF) ou edições em outras abas.
--
-- REPLICA IDENTITY FULL é necessário para que payloads de UPDATE/DELETE
-- contenham os valores antigos completos (caso queiramos diff no futuro).

ALTER TABLE public.ordens_venda REPLICA IDENTITY FULL;
ALTER TABLE public.notas_fiscais REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'ordens_venda'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.ordens_venda';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notas_fiscais'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notas_fiscais';
  END IF;
END $$;