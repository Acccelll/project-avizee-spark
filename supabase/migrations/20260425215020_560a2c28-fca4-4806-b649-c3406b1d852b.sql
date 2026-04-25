CREATE TABLE IF NOT EXISTS public.apresentacao_cadencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  template_id uuid REFERENCES public.apresentacao_templates(id) ON DELETE SET NULL,
  modo_geracao text NOT NULL DEFAULT 'fechado',
  dia_do_mes integer NOT NULL DEFAULT 5,
  exigir_revisao boolean NOT NULL DEFAULT true,
  destinatarios_emails text[] NOT NULL DEFAULT '{}',
  ativo boolean NOT NULL DEFAULT true,
  ultima_execucao_em timestamptz,
  ultima_execucao_status text,
  ultima_execucao_geracao_id uuid,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_apresentacao_cadencia_dia CHECK (dia_do_mes BETWEEN 1 AND 28),
  CONSTRAINT chk_apresentacao_cadencia_modo CHECK (modo_geracao IN ('dinamico', 'fechado'))
);

ALTER TABLE public.apresentacao_geracoes
  ADD COLUMN IF NOT EXISTS cadencia_id uuid REFERENCES public.apresentacao_cadencia(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_apresentacao_cadencia_ativo ON public.apresentacao_cadencia(ativo, dia_do_mes);
CREATE INDEX IF NOT EXISTS idx_apresentacao_geracoes_cadencia ON public.apresentacao_geracoes(cadencia_id);

ALTER TABLE public.apresentacao_cadencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "apresentacao_cadencia_select"
  ON public.apresentacao_cadencia FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.resource = 'apresentacao'
        AND up.action IN ('visualizar', 'gerenciar_templates', 'gerar', 'aprovar')
        AND up.allowed = true
    )
  );

CREATE POLICY "apresentacao_cadencia_insert"
  ON public.apresentacao_cadencia FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.resource = 'apresentacao'
        AND up.action = 'gerenciar_templates'
        AND up.allowed = true
    )
  );

CREATE POLICY "apresentacao_cadencia_update"
  ON public.apresentacao_cadencia FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.resource = 'apresentacao'
        AND up.action = 'gerenciar_templates'
        AND up.allowed = true
    )
  );

CREATE POLICY "apresentacao_cadencia_delete"
  ON public.apresentacao_cadencia FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_apresentacao_cadencia_updated_at
  BEFORE UPDATE ON public.apresentacao_cadencia
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();