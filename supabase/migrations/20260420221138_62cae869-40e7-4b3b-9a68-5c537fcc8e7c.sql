-- Colunas estruturadas
ALTER TABLE public.permission_audit
  ADD COLUMN IF NOT EXISTS tipo_acao text NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS entidade text,
  ADD COLUMN IF NOT EXISTS entidade_id text,
  ADD COLUMN IF NOT EXISTS motivo text,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS user_agent text;

COMMENT ON COLUMN public.permission_audit.tipo_acao IS 'Categoria canônica: user_create, user_update, user_status_change, role_grant, role_revoke, permission_grant, permission_revoke, permission_update, permission_delete, config_update, branding_update, logo_upload, legacy.';
COMMENT ON COLUMN public.permission_audit.entidade IS 'Tipo da entidade afetada: user, role, permission, app_config, empresa_config.';
COMMENT ON COLUMN public.permission_audit.entidade_id IS 'Identificador da entidade (uuid em string ou chave de config).';

-- Backfill: tenta extrair tipo de alteracao->>'tipo'
UPDATE public.permission_audit
SET tipo_acao = COALESCE(NULLIF(alteracao->>'tipo', ''), tipo_acao)
WHERE tipo_acao = 'legacy' AND alteracao ? 'tipo';

-- Índices úteis para a UI de auditoria
CREATE INDEX IF NOT EXISTS idx_permission_audit_created_at ON public.permission_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_permission_audit_tipo_acao  ON public.permission_audit (tipo_acao);
CREATE INDEX IF NOT EXISTS idx_permission_audit_entidade   ON public.permission_audit (entidade, entidade_id);

-- View unificada de auditoria administrativa
CREATE OR REPLACE VIEW public.v_admin_audit_unified AS
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

COMMENT ON VIEW public.v_admin_audit_unified IS 'Trilha unificada de eventos administrativos (permission_audit + auditoria_logs filtrada). Consumida pela aba Auditoria do módulo Administração.';