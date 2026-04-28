-- Onda 8 — Manifestação do Destinatário (NF-e de entrada por chave)

-- Tabela de NF-e capturadas (entrada por chave / DistDF-e)
CREATE TABLE IF NOT EXISTS public.nfe_distribuicao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave_acesso text NOT NULL UNIQUE,
  cnpj_emitente text,
  nome_emitente text,
  numero text,
  serie text,
  data_emissao timestamptz,
  valor_total numeric(15,2),
  protocolo_autorizacao text,
  status_manifestacao text NOT NULL DEFAULT 'sem_manifestacao',
  data_manifestacao timestamptz,
  xml_nfe text,
  observacao text,
  usuario_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_nfe_dist_chave CHECK (char_length(chave_acesso) = 44),
  CONSTRAINT chk_nfe_dist_status CHECK (status_manifestacao IN (
    'sem_manifestacao','ciencia','confirmada','desconhecida','nao_realizada'
  ))
);

CREATE INDEX IF NOT EXISTS idx_nfe_dist_status ON public.nfe_distribuicao(status_manifestacao);
CREATE INDEX IF NOT EXISTS idx_nfe_dist_emitente ON public.nfe_distribuicao(cnpj_emitente);

ALTER TABLE public.nfe_distribuicao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_nfe_dist" ON public.nfe_distribuicao FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_nfe_dist" ON public.nfe_distribuicao FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_nfe_dist" ON public.nfe_distribuicao FOR UPDATE TO authenticated USING (true);
CREATE POLICY "admin_delete_nfe_dist" ON public.nfe_distribuicao FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_nfe_dist_updated_at
  BEFORE UPDATE ON public.nfe_distribuicao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Coluna para vincular evento de manifestação à NF-e de distribuição (entrada)
ALTER TABLE public.eventos_fiscais
  ADD COLUMN IF NOT EXISTS nfe_distribuicao_id uuid REFERENCES public.nfe_distribuicao(id) ON DELETE CASCADE;

-- nota_fiscal_id passa a ser opcional pois eventos de entrada referenciam nfe_distribuicao
ALTER TABLE public.eventos_fiscais
  ALTER COLUMN nota_fiscal_id DROP NOT NULL;

-- Garante que o evento aponta para uma das duas (saída interna OU entrada por distribuição)
ALTER TABLE public.eventos_fiscais
  DROP CONSTRAINT IF EXISTS chk_eventos_fiscais_destino;
ALTER TABLE public.eventos_fiscais
  ADD CONSTRAINT chk_eventos_fiscais_destino
  CHECK (nota_fiscal_id IS NOT NULL OR nfe_distribuicao_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_eventos_fiscais_dist ON public.eventos_fiscais(nfe_distribuicao_id);