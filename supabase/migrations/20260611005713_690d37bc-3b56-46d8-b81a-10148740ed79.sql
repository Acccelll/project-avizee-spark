
-- =====================================================================
-- FRENTE 2: View funcionarios_basico + restrição admin-only na base
-- =====================================================================

CREATE OR REPLACE VIEW public.funcionarios_basico AS
SELECT id, nome, cargo, departamento, ativo, created_at, updated_at
FROM public.funcionarios;

ALTER VIEW public.funcionarios_basico SET (security_invoker = false);
GRANT SELECT ON public.funcionarios_basico TO authenticated;

COMMENT ON VIEW public.funcionarios_basico IS
  'SECURITY DEFINER intencional: expõe somente campos não sensíveis de funcionarios (sem salario_base, cpf, datas contratuais) para roles operacionais.';

DROP POLICY IF EXISTS "func_select" ON public.funcionarios;
CREATE POLICY "func_select" ON public.funcionarios
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =====================================================================
-- FRENTE 3: cron_health + helper touch_cron_health
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.cron_health (
  job_name text PRIMARY KEY,
  last_run_at timestamptz NOT NULL DEFAULT now(),
  last_status text NOT NULL DEFAULT 'ok',
  last_error text,
  runs_count bigint NOT NULL DEFAULT 0,
  CONSTRAINT chk_cron_health_status CHECK (last_status IN ('ok','error'))
);

GRANT SELECT ON public.cron_health TO authenticated;
GRANT ALL ON public.cron_health TO service_role;

ALTER TABLE public.cron_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cron_health_admin_select" ON public.cron_health
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Sem policies de INSERT/UPDATE/DELETE: escrita só pelo service_role (bypassa RLS).

CREATE OR REPLACE FUNCTION public.touch_cron_health(
  p_job text,
  p_status text,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.cron_health (job_name, last_run_at, last_status, last_error, runs_count)
  VALUES (p_job, now(), p_status, p_error, 1)
  ON CONFLICT (job_name) DO UPDATE
    SET last_run_at = now(),
        last_status = EXCLUDED.last_status,
        last_error = EXCLUDED.last_error,
        runs_count = public.cron_health.runs_count + 1;
$$;

REVOKE ALL ON FUNCTION public.touch_cron_health(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.touch_cron_health(text, text, text) TO service_role;

COMMENT ON FUNCTION public.touch_cron_health(text, text, text) IS
  'Heartbeat para cron jobs (edge functions). Chamado via service role no fim de cada execução para alimentar public.cron_health.';
