
-- Wrappers públicos para pgmq da fila webhook_events (PostgREST não expõe schema pgmq)
CREATE OR REPLACE FUNCTION public.webhooks_queue_read(p_qty integer DEFAULT 1, p_vt integer DEFAULT 30)
RETURNS TABLE(msg_id bigint, read_ct integer, enqueued_at timestamptz, vt timestamptz, message jsonb)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT msg_id, read_ct, enqueued_at, vt, message
  FROM pgmq.read('webhook_events', p_vt, p_qty);
$$;

CREATE OR REPLACE FUNCTION public.webhooks_queue_delete(p_msg_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pgmq.delete('webhook_events', p_msg_id);
$$;

REVOKE ALL ON FUNCTION public.webhooks_queue_read(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.webhooks_queue_delete(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.webhooks_queue_read(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.webhooks_queue_delete(bigint) TO service_role;

-- Limpa mensagem antiga da DLQ de e-mails transacionais (orçamento de abril/2026 já obsoleto)
SELECT pgmq.delete('transactional_emails_dlq', msg_id)
FROM pgmq.q_transactional_emails_dlq;
