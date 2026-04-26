ALTER TABLE public.apresentacao_geracoes
  ADD COLUMN IF NOT EXISTS empresa_id uuid NULL,
  ADD COLUMN IF NOT EXISTS slide_config_json jsonb NULL,
  ADD COLUMN IF NOT EXISTS data_origem_json jsonb NULL,
  ADD COLUMN IF NOT EXISTS aprovado_por uuid NULL,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS is_final boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_slides integer NULL,
  ADD COLUMN IF NOT EXISTS gerado_em timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS fechamento_id_inicial uuid NULL,
  ADD COLUMN IF NOT EXISTS fechamento_id_final uuid NULL;

CREATE INDEX IF NOT EXISTS idx_apresentacao_geracoes_status_editorial
  ON public.apresentacao_geracoes(status_editorial);
CREATE INDEX IF NOT EXISTS idx_apresentacao_geracoes_is_final
  ON public.apresentacao_geracoes(is_final);

ALTER TABLE public.apresentacao_comentarios
  ADD COLUMN IF NOT EXISTS titulo text NULL,
  ADD COLUMN IF NOT EXISTS comentario_editado text NULL,
  ADD COLUMN IF NOT EXISTS comentario_status text NOT NULL DEFAULT 'automatico',
  ADD COLUMN IF NOT EXISTS prioridade integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS tags_json jsonb NULL,
  ADD COLUMN IF NOT EXISTS origem text NULL,
  ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_apresentacao_comentarios_status'
  ) THEN
    ALTER TABLE public.apresentacao_comentarios
      ADD CONSTRAINT chk_apresentacao_comentarios_status
      CHECK (comentario_status IN ('automatico','editado','aprovado'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_apresentacao_comentarios_geracao_ordem
  ON public.apresentacao_comentarios(geracao_id, ordem);