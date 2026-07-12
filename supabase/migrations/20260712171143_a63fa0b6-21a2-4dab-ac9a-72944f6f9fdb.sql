
-- 1) Tabela de lotes de importação
CREATE TABLE public.cartao_importacao_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT current_empresa_id(),
  criado_por uuid,
  faturas_criadas uuid[] NOT NULL DEFAULT '{}',
  faturas_atualizadas uuid[] NOT NULL DEFAULT '{}',
  vinculos jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{linha_id, lancamento_id, fatura_id}]
  resumo jsonb NOT NULL DEFAULT '{}'::jsonb,
  desfeito_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cartao_importacao_lotes TO authenticated;
GRANT ALL ON public.cartao_importacao_lotes TO service_role;

ALTER TABLE public.cartao_importacao_lotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cartao_imp_lotes_select" ON public.cartao_importacao_lotes
FOR SELECT TO authenticated
USING (empresa_id = current_empresa_id() OR has_role(auth.uid(),'admin'));

CREATE POLICY "cartao_imp_lotes_write" ON public.cartao_importacao_lotes
FOR ALL TO authenticated
USING ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'financeiro')) AND (empresa_id = current_empresa_id() OR has_role(auth.uid(),'admin')))
WITH CHECK ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'financeiro')) AND (empresa_id = current_empresa_id() OR has_role(auth.uid(),'admin')));

CREATE INDEX idx_cartao_imp_lotes_empresa ON public.cartao_importacao_lotes(empresa_id, created_at DESC);

CREATE TRIGGER trg_cartao_imp_lotes_updated
BEFORE UPDATE ON public.cartao_importacao_lotes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) RPC para registrar um lote (chamada pelo frontend após importar)
CREATE OR REPLACE FUNCTION public.cartao_importacao_registrar_lote(
  p_faturas_criadas uuid[],
  p_faturas_atualizadas uuid[],
  p_vinculos jsonb,
  p_resumo jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro')) THEN
    RAISE EXCEPTION 'permissao_negada';
  END IF;

  INSERT INTO public.cartao_importacao_lotes (
    empresa_id, criado_por, faturas_criadas, faturas_atualizadas, vinculos, resumo
  ) VALUES (
    public.current_empresa_id(), auth.uid(),
    COALESCE(p_faturas_criadas,'{}'), COALESCE(p_faturas_atualizadas,'{}'),
    COALESCE(p_vinculos,'[]'::jsonb), COALESCE(p_resumo,'{}'::jsonb)
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 3) RPC para desfazer um lote
CREATE OR REPLACE FUNCTION public.cartao_importacao_desfazer(p_lote uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lote public.cartao_importacao_lotes;
  v_v jsonb;
  v_desvinculadas int := 0;
  v_faturas_removidas int := 0;
  v_lanc_limpos int := 0;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro')) THEN
    RAISE EXCEPTION 'permissao_negada';
  END IF;

  SELECT * INTO v_lote FROM public.cartao_importacao_lotes WHERE id = p_lote;
  IF NOT FOUND THEN RAISE EXCEPTION 'lote_nao_encontrado'; END IF;
  IF v_lote.desfeito_em IS NOT NULL THEN RAISE EXCEPTION 'lote_ja_desfeito'; END IF;
  IF v_lote.empresa_id <> public.current_empresa_id() AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'empresa_invalida';
  END IF;

  -- Desvincula linhas que este lote vinculou
  FOR v_v IN SELECT * FROM jsonb_array_elements(v_lote.vinculos)
  LOOP
    UPDATE public.cartao_fatura_lancamentos
       SET lancamento_id = NULL, status = 'pendente'
     WHERE id = (v_v->>'linha_id')::uuid
       AND lancamento_id = (v_v->>'lancamento_id')::uuid;
    GET DIAGNOSTICS v_desvinculadas = ROW_COUNT;

    UPDATE public.financeiro_lancamentos
       SET cartao_fatura_id = NULL
     WHERE id = (v_v->>'lancamento_id')::uuid
       AND cartao_fatura_id = (v_v->>'fatura_id')::uuid;
    GET DIAGNOSTICS v_lanc_limpos = ROW_COUNT;
  END LOOP;

  -- Apaga faturas criadas por este lote (cascade em linhas)
  IF array_length(v_lote.faturas_criadas,1) > 0 THEN
    DELETE FROM public.cartao_faturas
     WHERE id = ANY(v_lote.faturas_criadas)
       AND status <> 'paga';
    GET DIAGNOSTICS v_faturas_removidas = ROW_COUNT;
  END IF;

  UPDATE public.cartao_importacao_lotes
     SET desfeito_em = now()
   WHERE id = p_lote;

  RETURN jsonb_build_object(
    'lote_id', p_lote,
    'faturas_removidas', v_faturas_removidas,
    'linhas_desvinculadas', jsonb_array_length(v_lote.vinculos)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cartao_importacao_registrar_lote(uuid[],uuid[],jsonb,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cartao_importacao_desfazer(uuid) TO authenticated;
