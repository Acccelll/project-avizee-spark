
-- C-01: Indicador de presença + data/hora de saída (NT 2019.001+)
ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS indicador_presenca text DEFAULT '0',
  ADD COLUMN IF NOT EXISTS data_saida date,
  ADD COLUMN IF NOT EXISTS hora_saida time without time zone,
  -- C-02: dados do veículo (transportadora_id já existia)
  ADD COLUMN IF NOT EXISTS veiculo_placa text,
  ADD COLUMN IF NOT EXISTS veiculo_uf text,
  -- B-01: Intermediador (NT 2020.006)
  ADD COLUMN IF NOT EXISTS via_intermediador boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS intermediador_cnpj text,
  ADD COLUMN IF NOT EXISTS intermediador_identificador text;

-- Constraints de domínio
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_nf_indicador_presenca') THEN
    ALTER TABLE public.notas_fiscais
      ADD CONSTRAINT chk_nf_indicador_presenca
      CHECK (indicador_presenca IS NULL OR indicador_presenca IN ('0','1','2','3','4','9'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_nf_data_saida_ge_emissao') THEN
    ALTER TABLE public.notas_fiscais
      ADD CONSTRAINT chk_nf_data_saida_ge_emissao
      CHECK (
        data_saida IS NULL
        OR data_emissao IS NULL
        OR data_saida >= (data_emissao::date)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_nf_veiculo_uf') THEN
    ALTER TABLE public.notas_fiscais
      ADD CONSTRAINT chk_nf_veiculo_uf
      CHECK (veiculo_uf IS NULL OR veiculo_uf ~ '^[A-Z]{2}$');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_nf_intermediador_cnpj') THEN
    ALTER TABLE public.notas_fiscais
      ADD CONSTRAINT chk_nf_intermediador_cnpj
      CHECK (
        intermediador_cnpj IS NULL
        OR intermediador_cnpj ~ '^\d{14}$'
      );
  END IF;
END$$;

-- Adicionar flag transportadora em fornecedores (para autocomplete C-02)
ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS transportadora boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_fornecedores_transportadora
  ON public.fornecedores(transportadora) WHERE transportadora = true;
