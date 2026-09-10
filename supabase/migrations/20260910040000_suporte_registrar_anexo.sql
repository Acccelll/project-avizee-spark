-- =============================================================================
-- RPC suporte_registrar_anexo (segue 20260909120000 + 20260910030000)
-- ERP AVIZEE
--
-- Gap encontrado ao auditar a implementação contra a especificação aprovada:
-- o upload de anexo (`uploadAnexoChamado`, spec §14.1) fazia INSERT direto em
-- `suporte_anexos` — permitido pela RLS `suporte_anexos_insert` — mas nunca
-- gerava o evento `anexo_adicionado` na timeline (spec §26: "o histórico do
-- chamado não deve depender apenas de auditoria genérica"). A RLS de
-- `suporte_eventos_insert` só libera INSERT direto para tipo='comentario';
-- qualquer outro tipo de evento (incluindo anexo_adicionado) exige uma RPC
-- SECURITY DEFINER, como já é o padrão para todo o resto do domínio.
--
-- Esta RPC substitui o INSERT direto do client: o upload para o Storage
-- continua acontecendo no client (RPC não fala com Storage), mas o registro
-- da linha em `suporte_anexos` + o evento da timeline agora são atômicos.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.suporte_registrar_anexo(
  p_chamado_id uuid,
  p_nome_arquivo text,
  p_tipo_arquivo text,
  p_caminho_storage text,
  p_tamanho bigint,
  p_is_screenshot boolean DEFAULT false
)
RETURNS public.suporte_anexos
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_evento_id uuid;
  v_anexo public.suporte_anexos%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF NOT public.has_role(v_user, 'admin'::app_role) AND NOT EXISTS (
    SELECT 1 FROM public.suporte_chamados c WHERE c.id = p_chamado_id AND c.solicitante_id = v_user
  ) THEN
    RAISE EXCEPTION 'Sem permissão para anexar arquivos a este chamado.';
  END IF;

  INSERT INTO public.suporte_eventos (chamado_id, tipo, autor_id, mensagem, visibilidade)
  VALUES (p_chamado_id, 'anexo_adicionado', v_user, p_nome_arquivo, 'publico')
  RETURNING id INTO v_evento_id;

  INSERT INTO public.suporte_anexos (
    chamado_id, evento_id, nome_arquivo, tipo_arquivo, caminho_storage, tamanho, is_screenshot, uploaded_by
  )
  VALUES (
    p_chamado_id, v_evento_id, p_nome_arquivo, p_tipo_arquivo, p_caminho_storage, p_tamanho, p_is_screenshot, v_user
  )
  RETURNING * INTO v_anexo;

  RETURN v_anexo;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.suporte_registrar_anexo(uuid, text, text, text, bigint, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suporte_registrar_anexo(uuid, text, text, text, bigint, boolean) TO authenticated;

-- =============================================================================
-- Fim da migration.
-- =============================================================================
