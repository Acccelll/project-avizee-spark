-- Funções de trigger não devem ser chamáveis via /rest/v1/rpc.
REVOKE EXECUTE ON FUNCTION public.site_materias_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.site_materias_log_status() FROM PUBLIC, anon, authenticated;
