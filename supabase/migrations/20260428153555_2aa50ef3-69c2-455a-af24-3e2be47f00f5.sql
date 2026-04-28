
-- ── Tabela remessa_etiquetas ────────────────────────────────────────────
CREATE TABLE public.remessa_etiquetas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remessa_id UUID NOT NULL REFERENCES public.remessas(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente',
  id_correios TEXT,
  codigo_objeto TEXT,
  id_recibo_pdf TEXT,
  pdf_path TEXT,
  payload_request JSONB,
  payload_response JSONB,
  erro_mensagem TEXT,
  created_by UUID REFERENCES auth.users(id),
  empresa_id UUID NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_remessa_etiquetas_status
    CHECK (status IN ('pendente','emitida','erro','cancelada'))
);

CREATE INDEX idx_remessa_etiquetas_remessa_id ON public.remessa_etiquetas(remessa_id);
CREATE INDEX idx_remessa_etiquetas_empresa_id ON public.remessa_etiquetas(empresa_id);
CREATE INDEX idx_remessa_etiquetas_status     ON public.remessa_etiquetas(status);
-- Apenas uma etiqueta "emitida" por remessa
CREATE UNIQUE INDEX uq_remessa_etiquetas_emitida_por_remessa
  ON public.remessa_etiquetas(remessa_id) WHERE status = 'emitida';

-- Trigger updated_at + empresa default
CREATE TRIGGER trg_remessa_etiquetas_updated_at
  BEFORE UPDATE ON public.remessa_etiquetas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_remessa_etiquetas_set_empresa
  BEFORE INSERT ON public.remessa_etiquetas
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_default();

-- ── RLS ────────────────────────────────────────────────────────────────
ALTER TABLE public.remessa_etiquetas ENABLE ROW LEVEL SECURITY;

CREATE POLICY re_select ON public.remessa_etiquetas FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      empresa_id = public.current_empresa_id()
      AND (
        has_role(auth.uid(), 'estoquista'::app_role)
        OR has_role(auth.uid(), 'vendedor'::app_role)
      )
    )
  );

CREATE POLICY re_insert ON public.remessa_etiquetas FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'estoquista'::app_role)
      OR has_role(auth.uid(), 'vendedor'::app_role)
    )
  );

CREATE POLICY re_update ON public.remessa_etiquetas FOR UPDATE TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'estoquista'::app_role)
    )
  );

CREATE POLICY re_delete ON public.remessa_etiquetas FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ── Storage bucket privado ─────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('etiquetas-correios','etiquetas-correios', false)
ON CONFLICT (id) DO NOTHING;

-- Path convention: <empresa_id>/<remessa_id>/<etiqueta_id>.pdf
CREATE POLICY "etiquetas_correios_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'etiquetas-correios'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR (
        (storage.foldername(name))[1] = public.current_empresa_id()::text
        AND (
          has_role(auth.uid(), 'estoquista'::app_role)
          OR has_role(auth.uid(), 'vendedor'::app_role)
        )
      )
    )
  );

CREATE POLICY "etiquetas_correios_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'etiquetas-correios'
    AND (storage.foldername(name))[1] = public.current_empresa_id()::text
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'estoquista'::app_role)
      OR has_role(auth.uid(), 'vendedor'::app_role)
    )
  );

CREATE POLICY "etiquetas_correios_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'etiquetas-correios'
    AND has_role(auth.uid(), 'admin'::app_role)
  );
