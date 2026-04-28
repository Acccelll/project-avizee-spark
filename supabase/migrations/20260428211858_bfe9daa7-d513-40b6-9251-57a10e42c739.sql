-- Tabela de eventos fiscais (CC-e, cancelamentos, manifestações)
CREATE TABLE IF NOT EXISTS public.eventos_fiscais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_fiscal_id uuid NOT NULL REFERENCES public.notas_fiscais(id) ON DELETE CASCADE,
  tipo_evento text NOT NULL,
  codigo_evento text,
  sequencia integer NOT NULL DEFAULT 1,
  justificativa text,
  correcao text,
  protocolo text,
  data_evento timestamptz,
  status_sefaz text NOT NULL DEFAULT 'pendente',
  motivo_retorno text,
  xml_envio text,
  xml_retorno text,
  usuario_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_eventos_fiscais_tipo CHECK (tipo_evento IN ('cce','cancelamento','manifestacao_ciencia','manifestacao_confirmada','manifestacao_desconhecida','manifestacao_nao_realizada')),
  CONSTRAINT chk_eventos_fiscais_status CHECK (status_sefaz IN ('pendente','autorizado','rejeitado','erro'))
);

CREATE INDEX IF NOT EXISTS idx_eventos_fiscais_nf ON public.eventos_fiscais(nota_fiscal_id);
CREATE INDEX IF NOT EXISTS idx_eventos_fiscais_tipo ON public.eventos_fiscais(tipo_evento);

ALTER TABLE public.eventos_fiscais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_eventos_fiscais" ON public.eventos_fiscais FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_eventos_fiscais" ON public.eventos_fiscais FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_eventos_fiscais" ON public.eventos_fiscais FOR UPDATE TO authenticated USING (true);
CREATE POLICY "admin_delete_eventos_fiscais" ON public.eventos_fiscais FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_eventos_fiscais_updated_at
  BEFORE UPDATE ON public.eventos_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de inutilizações de numeração
CREATE TABLE IF NOT EXISTS public.inutilizacoes_numeracao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo text NOT NULL DEFAULT '55',
  serie integer NOT NULL,
  ano integer NOT NULL,
  numero_inicial integer NOT NULL,
  numero_final integer NOT NULL,
  justificativa text NOT NULL,
  protocolo text,
  data_evento timestamptz,
  status_sefaz text NOT NULL DEFAULT 'pendente',
  motivo_retorno text,
  xml_envio text,
  xml_retorno text,
  usuario_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_inutilizacoes_status CHECK (status_sefaz IN ('pendente','autorizado','rejeitado','erro')),
  CONSTRAINT chk_inutilizacoes_faixa CHECK (numero_final >= numero_inicial),
  CONSTRAINT chk_inutilizacoes_justificativa CHECK (char_length(justificativa) >= 15)
);

CREATE INDEX IF NOT EXISTS idx_inutilizacoes_serie_ano ON public.inutilizacoes_numeracao(serie, ano);

ALTER TABLE public.inutilizacoes_numeracao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_inutilizacoes" ON public.inutilizacoes_numeracao FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_inutilizacoes" ON public.inutilizacoes_numeracao FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_inutilizacoes" ON public.inutilizacoes_numeracao FOR UPDATE TO authenticated USING (true);
CREATE POLICY "admin_delete_inutilizacoes" ON public.inutilizacoes_numeracao FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_inutilizacoes_updated_at
  BEFORE UPDATE ON public.inutilizacoes_numeracao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Coluna para chave da NF referenciada (devolução/complementar)
ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS nf_referenciada_chave text;