DROP VIEW IF EXISTS public.v_admin_audit_unified;

CREATE VIEW public.v_admin_audit_unified
WITH (security_invoker = true)
AS
SELECT
  pa.id,
  pa.created_at,
  pa.user_id          AS ator_id,
  pa.tipo_acao,
  pa.entidade,
  pa.entidade_id,
  pa.target_user_id,
  pa.motivo,
  pa.alteracao        AS payload,
  pa.ip_address,
  pa.user_agent,
  'permission_audit'::text AS origem
FROM public.permission_audit pa
UNION ALL
SELECT
  al.id,
  al.created_at,
  al.usuario_id       AS ator_id,
  al.acao             AS tipo_acao,
  al.tabela           AS entidade,
  al.registro_id      AS entidade_id,
  NULL::uuid          AS target_user_id,
  NULL::text          AS motivo,
  jsonb_build_object('antes', al.dados_anteriores, 'depois', al.dados_novos) AS payload,
  al.ip_address::text AS ip_address,
  NULL::text          AS user_agent,
  'auditoria_logs'::text AS origem
FROM public.auditoria_logs al
WHERE al.tabela IN ('app_configuracoes', 'empresa_config', 'user_roles', 'user_permissions', 'profiles');

COMMENT ON VIEW public.v_admin_audit_unified IS 'Trilha unificada de eventos administrativos (permission_audit + auditoria_logs filtrada). security_invoker=true: respeita RLS do usuário autenticado.';