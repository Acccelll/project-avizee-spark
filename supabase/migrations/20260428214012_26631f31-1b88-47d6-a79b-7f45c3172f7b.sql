ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS modo_emissao_nfe text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS contingencia_motivo text,
  ADD COLUMN IF NOT EXISTS contingencia_inicio timestamptz;

-- Constraint de domínio
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_empresa_config_modo_emissao'
  ) THEN
    ALTER TABLE public.empresa_config
      ADD CONSTRAINT chk_empresa_config_modo_emissao
      CHECK (modo_emissao_nfe IN ('normal','contingencia_svc','contingencia_offline'));
  END IF;
END $$;

-- Trigger de validação: contingência exige motivo + início
CREATE OR REPLACE FUNCTION public.trg_validar_contingencia_nfe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.modo_emissao_nfe <> 'normal' THEN
    IF NEW.contingencia_motivo IS NULL OR length(trim(NEW.contingencia_motivo)) < 15 THEN
      RAISE EXCEPTION 'Contingência exige motivo com no mínimo 15 caracteres';
    END IF;
    IF NEW.contingencia_inicio IS NULL THEN
      NEW.contingencia_inicio := now();
    END IF;
  ELSE
    NEW.contingencia_motivo := NULL;
    NEW.contingencia_inicio := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_empresa_config_contingencia ON public.empresa_config;
CREATE TRIGGER trg_empresa_config_contingencia
  BEFORE INSERT OR UPDATE OF modo_emissao_nfe, contingencia_motivo, contingencia_inicio
  ON public.empresa_config
  FOR EACH ROW EXECUTE FUNCTION public.trg_validar_contingencia_nfe();