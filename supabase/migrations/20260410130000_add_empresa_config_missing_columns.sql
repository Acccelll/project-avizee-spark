-- Add missing columns to empresa_config that are referenced in Administracao.tsx
-- but were absent from the original schema, causing data loss on save/reload.

ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS inscricao_municipal TEXT,
  ADD COLUMN IF NOT EXISTS site TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS responsavel TEXT,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);
