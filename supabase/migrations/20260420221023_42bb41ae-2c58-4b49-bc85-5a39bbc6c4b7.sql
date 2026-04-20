-- 1) Adicionar colunas institucionais em empresa_config
ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS site text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS responsavel text,
  ADD COLUMN IF NOT EXISTS inscricao_municipal text,
  ADD COLUMN IF NOT EXISTS cor_primaria text,
  ADD COLUMN IF NOT EXISTS cor_secundaria text,
  ADD COLUMN IF NOT EXISTS geral_legacy jsonb;

-- 2) Backfill a partir de app_configuracoes['geral'] (apenas se empresa_config tiver linha e os campos estiverem vazios)
DO $$
DECLARE
  v_geral jsonb;
  v_empresa_id uuid;
BEGIN
  SELECT valor INTO v_geral
  FROM public.app_configuracoes
  WHERE chave = 'geral'
  LIMIT 1;

  SELECT id INTO v_empresa_id FROM public.empresa_config LIMIT 1;

  IF v_geral IS NOT NULL AND v_empresa_id IS NOT NULL THEN
    UPDATE public.empresa_config
    SET
      site                = COALESCE(site,                NULLIF(v_geral->>'site', '')),
      whatsapp            = COALESCE(whatsapp,            NULLIF(v_geral->>'whatsapp', '')),
      responsavel         = COALESCE(responsavel,         NULLIF(v_geral->>'responsavel', '')),
      inscricao_municipal = COALESCE(inscricao_municipal, NULLIF(v_geral->>'inscricaoMunicipal', '')),
      cor_primaria        = COALESCE(cor_primaria,        NULLIF(v_geral->>'corPrimaria', '')),
      cor_secundaria      = COALESCE(cor_secundaria,      NULLIF(v_geral->>'corSecundaria', '')),
      nome_fantasia       = COALESCE(nome_fantasia,       NULLIF(v_geral->>'nomeFantasia', '')),
      geral_legacy        = COALESCE(geral_legacy,        v_geral)
    WHERE id = v_empresa_id;
  END IF;
END $$;

COMMENT ON COLUMN public.empresa_config.geral_legacy IS 'Backup do JSON app_configuracoes[geral] no momento da migração de branding (admin_fronteira_branding). Pode ser removido após validação.';
COMMENT ON COLUMN public.empresa_config.cor_primaria IS 'Cor primária do branding (hex). Fonte canônica — substitui app_configuracoes[geral].corPrimaria.';
COMMENT ON COLUMN public.empresa_config.cor_secundaria IS 'Cor secundária do branding (hex). Fonte canônica.';
COMMENT ON COLUMN public.empresa_config.site IS 'Site institucional. Fonte canônica.';
COMMENT ON COLUMN public.empresa_config.whatsapp IS 'WhatsApp institucional. Fonte canônica.';
COMMENT ON COLUMN public.empresa_config.responsavel IS 'Responsável legal/contato. Fonte canônica.';
COMMENT ON COLUMN public.empresa_config.inscricao_municipal IS 'Inscrição municipal. Fonte canônica.';