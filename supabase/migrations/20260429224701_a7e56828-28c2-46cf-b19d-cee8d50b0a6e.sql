-- ============================================================
-- BLOCO 1: Vencimento na NF + parcelas
-- ============================================================
ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS data_vencimento DATE,
  ADD COLUMN IF NOT EXISTS numero_parcelas INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS intervalo_parcelas_dias INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS parcelas JSONB;

ALTER TABLE public.notas_fiscais
  DROP CONSTRAINT IF EXISTS chk_nf_numero_parcelas;
ALTER TABLE public.notas_fiscais
  ADD CONSTRAINT chk_nf_numero_parcelas CHECK (numero_parcelas >= 1);

ALTER TABLE public.notas_fiscais
  DROP CONSTRAINT IF EXISTS chk_nf_intervalo_parcelas;
ALTER TABLE public.notas_fiscais
  ADD CONSTRAINT chk_nf_intervalo_parcelas CHECK (intervalo_parcelas_dias >= 0);

COMMENT ON COLUMN public.notas_fiscais.data_vencimento IS
  'Primeiro vencimento (ou único, se à vista). Usado pelo financeiro para gerar contas a receber/pagar.';
COMMENT ON COLUMN public.notas_fiscais.numero_parcelas IS
  'Quantidade de parcelas (1 = à vista). Quando >1, intervalo_parcelas_dias define o passo entre vencimentos.';
COMMENT ON COLUMN public.notas_fiscais.parcelas IS
  'Override opcional das parcelas geradas. Estrutura: [{numero:int, data_vencimento:date, valor:numeric}]. Quando NULL, calcula automaticamente.';

-- ============================================================
-- BLOCO 3: RPCs de gestão de secrets no Vault
-- (somente admin; usado pelo CertificadoUploader para gravar
--  CERTIFICADO_PFX_SENHA sem expor service-role no client)
-- ============================================================
CREATE OR REPLACE FUNCTION public.salvar_secret_vault(p_name TEXT, p_secret TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem gravar segredos no cofre.';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Nome do segredo é obrigatório.';
  END IF;
  IF p_secret IS NULL OR length(p_secret) = 0 THEN
    RAISE EXCEPTION 'Conteúdo do segredo não pode ser vazio.';
  END IF;

  SELECT id INTO v_id FROM vault.secrets WHERE name = p_name LIMIT 1;
  IF v_id IS NULL THEN
    SELECT vault.create_secret(p_secret, p_name) INTO v_id;
  ELSE
    PERFORM vault.update_secret(v_id, p_secret);
  END IF;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_secret_vault(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salvar_secret_vault(TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.existe_secret_vault(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem consultar o cofre.';
  END IF;
  RETURN EXISTS (SELECT 1 FROM vault.secrets WHERE name = p_name);
END;
$$;
REVOKE ALL ON FUNCTION public.existe_secret_vault(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.existe_secret_vault(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.remover_secret_vault(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem remover segredos.';
  END IF;
  DELETE FROM vault.secrets WHERE name = p_name;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.remover_secret_vault(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remover_secret_vault(TEXT) TO authenticated;