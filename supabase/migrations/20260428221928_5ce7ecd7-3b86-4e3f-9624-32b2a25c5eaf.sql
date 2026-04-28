-- Onda 13 — DistDF-e: download automático de NF-e via SEFAZ Ambiente Nacional
-- Persiste o último NSU consultado para sincronização incremental por CNPJ.

CREATE TABLE IF NOT EXISTS public.nfe_distdfe_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text NOT NULL,
  ambiente text NOT NULL DEFAULT '2',  -- '1' produção, '2' homologação
  ultimo_nsu text NOT NULL DEFAULT '0',
  max_nsu text,
  ultima_sync_at timestamptz,
  ultima_resposta_cstat text,
  ultima_resposta_xmotivo text,
  ultima_qtd_docs integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_distdfe_ambiente CHECK (ambiente IN ('1','2')),
  CONSTRAINT chk_distdfe_cnpj_len CHECK (char_length(regexp_replace(cnpj, '\D', '', 'g')) = 14),
  CONSTRAINT uq_distdfe_cnpj_amb UNIQUE (cnpj, ambiente)
);

ALTER TABLE public.nfe_distdfe_sync ENABLE ROW LEVEL SECURITY;

-- Apenas usuários autenticados (módulo fiscal) leem; admin/financeiro escrevem.
CREATE POLICY "Distdfe sync select autenticados"
  ON public.nfe_distdfe_sync FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Distdfe sync insert admin/financeiro"
  ON public.nfe_distdfe_sync FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro')
  );

CREATE POLICY "Distdfe sync update admin/financeiro"
  ON public.nfe_distdfe_sync FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro')
  );

CREATE POLICY "Distdfe sync delete admin"
  ON public.nfe_distdfe_sync FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_nfe_distdfe_sync_updated_at
  BEFORE UPDATE ON public.nfe_distdfe_sync
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices úteis para auditoria.
CREATE INDEX IF NOT EXISTS idx_distdfe_sync_cnpj ON public.nfe_distdfe_sync(cnpj);

-- Coluna `nsu` em nfe_distribuicao para correlacionar NF-e capturada com o NSU
-- de origem (idempotência: ignorar reprocessamento do mesmo NSU/chave).
ALTER TABLE public.nfe_distribuicao
  ADD COLUMN IF NOT EXISTS nsu text;

CREATE INDEX IF NOT EXISTS idx_nfe_distribuicao_nsu ON public.nfe_distribuicao(nsu);
