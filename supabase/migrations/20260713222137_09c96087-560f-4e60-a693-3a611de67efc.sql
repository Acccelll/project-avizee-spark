
-- =====================================================================
-- Framework Fiscal — Infraestrutura Base (Etapa 4)
-- =====================================================================

-- 1) fiscal_endpoints — registry declarativo (ADR-003)
CREATE TABLE IF NOT EXISTS public.fiscal_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento TEXT NOT NULL,
  uf TEXT NOT NULL,
  ambiente SMALLINT NOT NULL,
  servico TEXT NOT NULL,
  versao TEXT NOT NULL,
  url TEXT NOT NULL,
  fonte TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_endpoints_documento CHECK (documento IN ('NFe','NFCe','CTe','MDFe','NFSe','DFe')),
  CONSTRAINT chk_endpoints_ambiente CHECK (ambiente IN (1,2)),
  CONSTRAINT chk_endpoints_uf CHECK (length(uf) = 2)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_fiscal_endpoints_unique
  ON public.fiscal_endpoints (documento, uf, ambiente, servico, versao)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_fiscal_endpoints_uf_amb ON public.fiscal_endpoints (uf, ambiente);
CREATE INDEX IF NOT EXISTS ix_fiscal_endpoints_doc_srv ON public.fiscal_endpoints (documento, servico);

GRANT SELECT ON public.fiscal_endpoints TO authenticated;
GRANT ALL ON public.fiscal_endpoints TO service_role;
ALTER TABLE public.fiscal_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "endpoints_select_authenticated" ON public.fiscal_endpoints
  FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "endpoints_admin_manage" ON public.fiscal_endpoints
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) fiscal_runtime_config
CREATE TABLE IF NOT EXISTS public.fiscal_runtime_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  sync_auto_ciencia BOOLEAN NOT NULL DEFAULT false,
  timeout_autorizacao_ms INT NOT NULL DEFAULT 15000,
  timeout_status_ms INT NOT NULL DEFAULT 8000,
  politica_retry JSONB NOT NULL DEFAULT '{"max":3,"backoff_ms":[500,1500,4000]}'::jsonb,
  contingencia_habilitada BOOLEAN NOT NULL DEFAULT false,
  parallelism JSONB NOT NULL DEFAULT '{"lote_max":50}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_frc_timeouts CHECK (timeout_autorizacao_ms > 0 AND timeout_status_ms > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_fiscal_runtime_config_empresa
  ON public.fiscal_runtime_config (COALESCE(empresa_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT ON public.fiscal_runtime_config TO authenticated;
GRANT ALL ON public.fiscal_runtime_config TO service_role;
ALTER TABLE public.fiscal_runtime_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "frc_select_membros" ON public.fiscal_runtime_config
  FOR SELECT TO authenticated
  USING (
    empresa_id IS NULL
    OR EXISTS (SELECT 1 FROM public.user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = fiscal_runtime_config.empresa_id)
  );
CREATE POLICY "frc_admin_manage" ON public.fiscal_runtime_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) fiscal_schemas_pl
CREATE TABLE IF NOT EXISTS public.fiscal_schemas_pl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento TEXT NOT NULL,
  versao_pl TEXT NOT NULL,
  vigente_de DATE NOT NULL,
  vigente_ate DATE,
  storage_prefix TEXT NOT NULL,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_schemas_documento CHECK (documento IN ('NFe','NFCe','CTe','MDFe','NFSe')),
  CONSTRAINT chk_schemas_vigencia CHECK (vigente_ate IS NULL OR vigente_ate >= vigente_de)
);
CREATE INDEX IF NOT EXISTS ix_fiscal_schemas_pl_doc ON public.fiscal_schemas_pl (documento, vigente_de DESC);

GRANT SELECT ON public.fiscal_schemas_pl TO authenticated;
GRANT ALL ON public.fiscal_schemas_pl TO service_role;
ALTER TABLE public.fiscal_schemas_pl ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schemas_select_authenticated" ON public.fiscal_schemas_pl FOR SELECT TO authenticated USING (true);
CREATE POLICY "schemas_admin_manage" ON public.fiscal_schemas_pl FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4) fiscal_certificado_metadata
CREATE TABLE IF NOT EXISTS public.fiscal_certificado_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL UNIQUE REFERENCES public.empresas(id) ON DELETE CASCADE,
  cnpj CHAR(14),
  razao_social TEXT,
  validade_inicio TIMESTAMPTZ,
  validade_fim TIMESTAMPTZ,
  storage_path TEXT,
  vault_secret_name TEXT,
  serial TEXT,
  subject_cn TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_fiscal_cert_validade_fim ON public.fiscal_certificado_metadata (validade_fim);

GRANT SELECT ON public.fiscal_certificado_metadata TO authenticated;
GRANT ALL ON public.fiscal_certificado_metadata TO service_role;
ALTER TABLE public.fiscal_certificado_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cert_select_membros" ON public.fiscal_certificado_metadata
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = fiscal_certificado_metadata.empresa_id));
CREATE POLICY "cert_admin_manage" ON public.fiscal_certificado_metadata
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5) fiscal_idempotency
CREATE TABLE IF NOT EXISTS public.fiscal_idempotency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  response_hash CHAR(64),
  response_status INT,
  expira_em TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ux_fiscal_idempotency UNIQUE (empresa_id, key)
);
CREATE INDEX IF NOT EXISTS ix_fiscal_idempotency_expira ON public.fiscal_idempotency (expira_em);

GRANT SELECT, INSERT ON public.fiscal_idempotency TO authenticated;
GRANT ALL ON public.fiscal_idempotency TO service_role;
ALTER TABLE public.fiscal_idempotency ENABLE ROW LEVEL SECURITY;

CREATE POLICY "idem_membros" ON public.fiscal_idempotency
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = fiscal_idempotency.empresa_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = fiscal_idempotency.empresa_id));

-- 6) fiscal_circuit_state
CREATE TABLE IF NOT EXISTS public.fiscal_circuit_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uf TEXT NOT NULL,
  ambiente SMALLINT NOT NULL,
  servico TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'closed',
  falhas_seguidas INT NOT NULL DEFAULT 0,
  aberto_desde TIMESTAMPTZ,
  ultima_verificacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ux_fiscal_circuit UNIQUE (uf, ambiente, servico),
  CONSTRAINT chk_circuit_estado CHECK (estado IN ('closed','open','half')),
  CONSTRAINT chk_circuit_ambiente CHECK (ambiente IN (1,2))
);

GRANT SELECT ON public.fiscal_circuit_state TO authenticated;
GRANT ALL ON public.fiscal_circuit_state TO service_role;
ALTER TABLE public.fiscal_circuit_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "circuit_select_authenticated" ON public.fiscal_circuit_state FOR SELECT TO authenticated USING (true);
CREATE POLICY "circuit_admin_manage" ON public.fiscal_circuit_state FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 7) fiscal_auditoria — append-only (5 anos)
CREATE TABLE IF NOT EXISTS public.fiscal_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  correlation_id UUID,
  operacao TEXT NOT NULL,
  ator UUID,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  documento TEXT,
  chave_acesso TEXT,
  request_hash CHAR(64),
  response_status INT,
  cstat TEXT,
  xmotivo TEXT,
  duracao_ms INT,
  endpoint_url TEXT,
  retryable BOOLEAN,
  tentativa INT,
  payload_extra JSONB
);
CREATE INDEX IF NOT EXISTS ix_fiscal_auditoria_empresa_ts ON public.fiscal_auditoria (empresa_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS ix_fiscal_auditoria_corr ON public.fiscal_auditoria (correlation_id);
CREATE INDEX IF NOT EXISTS ix_fiscal_auditoria_chave ON public.fiscal_auditoria (chave_acesso);
CREATE INDEX IF NOT EXISTS ix_fiscal_auditoria_op_ts ON public.fiscal_auditoria (operacao, timestamp DESC);

GRANT SELECT ON public.fiscal_auditoria TO authenticated;
GRANT ALL ON public.fiscal_auditoria TO service_role;
ALTER TABLE public.fiscal_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_select_membros" ON public.fiscal_auditoria
  FOR SELECT TO authenticated
  USING (
    empresa_id IS NULL
    OR EXISTS (SELECT 1 FROM public.user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = fiscal_auditoria.empresa_id)
  );

-- Trigger anti-tamper (append-only)
CREATE OR REPLACE FUNCTION public.fiscal_auditoria_block_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'fiscal_auditoria é append-only (operação % bloqueada)', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_fiscal_auditoria_no_update ON public.fiscal_auditoria;
CREATE TRIGGER trg_fiscal_auditoria_no_update
  BEFORE UPDATE OR DELETE ON public.fiscal_auditoria
  FOR EACH ROW EXECUTE FUNCTION public.fiscal_auditoria_block_mutation();

-- Triggers updated_at (reutilizando função existente do projeto)
DROP TRIGGER IF EXISTS trg_fiscal_endpoints_updated_at ON public.fiscal_endpoints;
CREATE TRIGGER trg_fiscal_endpoints_updated_at BEFORE UPDATE ON public.fiscal_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_fiscal_runtime_config_updated_at ON public.fiscal_runtime_config;
CREATE TRIGGER trg_fiscal_runtime_config_updated_at BEFORE UPDATE ON public.fiscal_runtime_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_fiscal_schemas_pl_updated_at ON public.fiscal_schemas_pl;
CREATE TRIGGER trg_fiscal_schemas_pl_updated_at BEFORE UPDATE ON public.fiscal_schemas_pl
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_fiscal_cert_metadata_updated_at ON public.fiscal_certificado_metadata;
CREATE TRIGGER trg_fiscal_cert_metadata_updated_at BEFORE UPDATE ON public.fiscal_certificado_metadata
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
