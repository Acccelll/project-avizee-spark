-- Função SECURITY DEFINER para expor métricas das filas pgmq de e-mail
-- ao painel "Saúde do sistema". Acesso restrito a administradores.
CREATE OR REPLACE FUNCTION public.email_queue_metrics()
RETURNS TABLE (
  queue_name TEXT,
  total_messages BIGINT,
  oldest_msg_age_seconds BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q TEXT;
  qs TEXT[] := ARRAY[
    'auth_emails',
    'transactional_emails',
    'auth_emails_dlq',
    'transactional_emails_dlq'
  ];
  v_total BIGINT;
  v_age BIGINT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  FOREACH q IN ARRAY qs LOOP
    BEGIN
      EXECUTE format(
        'SELECT count(*)::bigint, COALESCE(EXTRACT(EPOCH FROM (now() - min(enqueued_at)))::bigint, 0) FROM pgmq.q_%I',
        q
      ) INTO v_total, v_age;
      queue_name := q;
      total_messages := COALESCE(v_total, 0);
      oldest_msg_age_seconds := COALESCE(v_age, 0);
      RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      -- Fila ainda não criada: retorna zeros
      queue_name := q;
      total_messages := 0;
      oldest_msg_age_seconds := 0;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.email_queue_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_queue_metrics() TO authenticated;

COMMENT ON FUNCTION public.email_queue_metrics() IS
  'Retorna tamanho e idade da mensagem mais antiga de cada fila pgmq de e-mail. Apenas admin.';
