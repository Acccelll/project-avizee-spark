-- =============================================================================
-- Hardening de segurança do domínio suporte_* (segue 20260909120000)
-- ERP AVIZEE
--
-- Achados do Supabase security advisor logo após aplicar a migration original:
--
--  1. CRÍTICO — `suporte_confirmar_resolucao` tinha uma checagem de posse
--     NULL-unsafe: `v_chamado.solicitante_id <> v_user`. Em Postgres,
--     qualquer comparação com NULL avalia para NULL, e `IF NULL THEN` é
--     tratado como falso (não levanta a exceção). Como `auth.uid()` retorna
--     NULL para o papel `anon` (sem JWT de usuário), uma chamada anônima a
--     essa RPC pulava a checagem de dono/admin por completo e conseguia
--     fechar ou reabrir QUALQUER chamado em estado 'resolvido'. Corrigido
--     rejeitando `v_user IS NULL` explicitamente, no mesmo padrão já usado
--     nas outras 9 RPCs deste domínio.
--
--  2. `gerar_numero_suporte` não tinha `SET search_path`, então herdava
--     search_path mutável do chamador — inconsistente com todas as outras
--     funções deste domínio, que já fixam `search_path TO 'public'`.
--
--  3. Todas as 10 funções do domínio ficaram executáveis pelo papel `anon`
--     via `/rest/v1/rpc/...`, porque CREATE FUNCTION concede EXECUTE a
--     PUBLIC por padrão e `anon` herda privilégios de PUBLIC. A migration
--     original só tinha GRANT explícito para `authenticated`, sem REVOKE de
--     PUBLIC. Os guards internos (`auth.uid() IS NULL` / `has_role`) cobrem
--     a maioria dos casos (has_role(NULL, ...) usa EXISTS e retorna FALSE,
--     não NULL), mas o achado nº 1 mostra que depender só disso é frágil.
--     Aqui fechamos a superfície na origem: REVOKE de PUBLIC, mantendo só
--     o acesso explícito de `authenticated` já concedido.
--
-- Nenhuma tabela ou policy é alterada aqui — só definições de função e grants.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Corrigir a checagem de posse NULL-unsafe em suporte_confirmar_resolucao
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.suporte_confirmar_resolucao(p_chamado_id uuid, p_confirmado boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_chamado public.suporte_chamados%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT * INTO v_chamado FROM public.suporte_chamados WHERE id = p_chamado_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado % não encontrado.', p_chamado_id;
  END IF;
  IF v_chamado.solicitante_id <> v_user AND NOT public.has_role(v_user, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Sem permissão para confirmar este chamado.';
  END IF;
  IF v_chamado.status <> 'resolvido' THEN
    RAISE EXCEPTION 'Chamado não está em estado Resolvido.';
  END IF;

  IF p_confirmado THEN
    UPDATE public.suporte_chamados SET status = 'fechado', closed_at = now() WHERE id = p_chamado_id;
    INSERT INTO public.suporte_eventos (chamado_id, tipo, autor_id, dados_anteriores, dados_novos)
    VALUES (p_chamado_id, 'fechamento', v_user,
            jsonb_build_object('status', 'resolvido'), jsonb_build_object('status', 'fechado'));
  ELSE
    UPDATE public.suporte_chamados SET status = 'em_andamento' WHERE id = p_chamado_id;
    INSERT INTO public.suporte_eventos (chamado_id, tipo, autor_id, dados_anteriores, dados_novos)
    VALUES (p_chamado_id, 'reabertura', v_user,
            jsonb_build_object('status', 'resolvido'), jsonb_build_object('status', 'em_andamento'));
  END IF;
END;
$function$;

-- -----------------------------------------------------------------------------
-- 2. Fixar search_path em gerar_numero_suporte
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.gerar_numero_suporte()
RETURNS text LANGUAGE sql SET search_path TO 'public' AS $$
  SELECT 'CH-' || lpad(nextval('public.suporte_chamados_numero_seq')::text, 6, '0');
$$;

-- -----------------------------------------------------------------------------
-- 3. Fechar a superfície de execução: revogar PUBLIC (e portanto `anon`),
--    mantendo apenas o acesso de `authenticated` já concedido explicitamente.
-- -----------------------------------------------------------------------------

-- gerar_numero_suporte nunca teve GRANT explícito (só era alcançável via o
-- PUBLIC padrão do CREATE FUNCTION) — sem o GRANT abaixo, revogar PUBLIC
-- quebraria o DEFAULT da coluna `numero` num INSERT direto na tabela por um
-- cliente authenticated (permitido pela RLS suporte_chamados_insert), já que
-- nesse caminho o DEFAULT roda no contexto do papel chamador, não do dono da
-- função. A RPC criar_chamado_suporte não depende disso: por ser SECURITY
-- DEFINER e de propriedade de postgres, o INSERT que ela faz roda como
-- postgres, que sempre retém acesso a gerar_numero_suporte por ownership.
REVOKE EXECUTE ON FUNCTION public.gerar_numero_suporte() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gerar_numero_suporte() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.criar_chamado_suporte(
  public.suporte_tipo, text, text, public.suporte_impacto, public.suporte_abrangencia,
  public.suporte_frequencia, text, text, uuid, jsonb
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.registrar_comentario_suporte(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.suporte_assumir_chamado(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.suporte_atribuir_responsavel(uuid, uuid) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.suporte_triar_chamado(
  uuid, public.suporte_tipo, public.suporte_prioridade, text, public.suporte_status
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.suporte_resolver_chamado(uuid, text, public.suporte_causa) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.suporte_confirmar_resolucao(uuid, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.suporte_cancelar_chamado(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.suporte_marcar_duplicado(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.obter_diagnostico_suporte(uuid) FROM PUBLIC;

-- =============================================================================
-- Fim da migration.
-- =============================================================================
