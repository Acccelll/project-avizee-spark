-- 1) Remove o índice único que bloqueava 1↔N (uma transação de extrato ↔ várias baixas)
DROP INDEX IF EXISTS public.uq_baixa_conta_extrato_ref;

-- Índice de apoio para lookups por (conta, extrato_ref) continua útil, sem unicidade.
CREATE INDEX IF NOT EXISTS idx_baixa_conta_extrato_ref
  ON public.financeiro_baixas (conta_bancaria_id, conciliacao_extrato_referencia)
  WHERE conciliacao_extrato_referencia IS NOT NULL
    AND estornada_em IS NULL;

-- 2) Ajusta a RPC removendo o guard que impedia múltiplas baixas para o mesmo fitid
CREATE OR REPLACE FUNCTION public.financeiro_conciliar_baixa(
  p_baixa_id uuid,
  p_status text,
  p_extrato_referencia text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conta uuid;
BEGIN
  IF p_status NOT IN ('pendente','conciliado','divergente','desconciliado') THEN
    RAISE EXCEPTION 'Status de conciliação inválido: %', p_status USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('fin_conciliar_baixa:' || p_baixa_id::text));

  SELECT conta_bancaria_id INTO v_conta
    FROM public.financeiro_baixas WHERE id = p_baixa_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Baixa % não encontrada', p_baixa_id;
  END IF;

  -- Nota: 1↔N (um extrato para vários lançamentos) é permitido.
  -- A mesma referência de extrato pode aparecer em mais de uma baixa ativa.

  UPDATE public.financeiro_baixas
     SET conciliacao_status = p_status,
         conciliacao_extrato_referencia = COALESCE(p_extrato_referencia, conciliacao_extrato_referencia),
         conciliacao_data = CASE WHEN p_status = 'pendente' THEN NULL ELSE now() END,
         conciliacao_usuario = CASE WHEN p_status = 'pendente' THEN NULL ELSE auth.uid() END
   WHERE id = p_baixa_id;

  INSERT INTO public.financeiro_auditoria(evento, baixa_id, payload, usuario_id)
  VALUES (
    CASE WHEN p_status IN ('desconciliado','pendente') THEN 'desconciliacao' ELSE 'conciliacao' END,
    p_baixa_id,
    jsonb_build_object('status', p_status, 'extrato', p_extrato_referencia),
    auth.uid()
  );
END;
$$;