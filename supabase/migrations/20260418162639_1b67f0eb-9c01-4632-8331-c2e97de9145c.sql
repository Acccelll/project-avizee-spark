-- Drop role_permissions e user_has_permission (Fase 7 — caminho 2: hard-code canônico)
-- A matriz de permissões padrão por papel é definida em código (src/lib/permissions.ts).
-- Apenas user_permissions (overrides individuais com allow/deny) permanece no DB.

DROP FUNCTION IF EXISTS public.user_has_permission(uuid, text, text);
DROP TABLE IF EXISTS public.role_permissions CASCADE;