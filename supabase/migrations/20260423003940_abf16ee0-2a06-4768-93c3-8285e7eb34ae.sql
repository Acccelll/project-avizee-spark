-- Recriar v_admin_audit_unified (mesma definição) para regenerar types.ts.
-- Necessário para que useAdminAuditUnificada possa consumir a view sem cast `any`.
CREATE OR REPLACE VIEW public.v_admin_audit_unified AS
  SELECT pa.id,
     pa.created_at,
     pa.user_id AS ator_id,
     pa.tipo_acao,
     pa.entidade,
     pa.entidade_id,
     pa.target_user_id,
     pa.motivo,
     pa.alteracao AS payload,
     pa.ip_address,
     pa.user_agent,
     'permission_audit'::text AS origem
    FROM public.permission_audit pa
 UNION ALL
  SELECT al.id,
     al.created_at,
     al.usuario_id AS ator_id,
     al.acao AS tipo_acao,
     al.tabela AS entidade,
     al.registro_id AS entidade_id,
     NULL::uuid AS target_user_id,
     NULL::text AS motivo,
     jsonb_build_object('antes', al.dados_anteriores, 'depois', al.dados_novos) AS payload,
     al.ip_address,
     NULL::text AS user_agent,
     'auditoria_logs'::text AS origem
    FROM public.auditoria_logs al
   WHERE al.tabela = ANY (ARRAY['app_configuracoes'::text, 'empresa_config'::text, 'user_roles'::text, 'user_permissions'::text, 'profiles'::text]);