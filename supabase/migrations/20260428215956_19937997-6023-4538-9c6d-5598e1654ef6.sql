-- Onda 9 — Importação de XML de NF-e
ALTER TABLE public.nfe_distribuicao
  ADD COLUMN IF NOT EXISTS uf_emitente text,
  ADD COLUMN IF NOT EXISTS ie_emitente text,
  ADD COLUMN IF NOT EXISTS valor_icms numeric(15,2),
  ADD COLUMN IF NOT EXISTS valor_ipi numeric(15,2),
  ADD COLUMN IF NOT EXISTS natureza_operacao text,
  ADD COLUMN IF NOT EXISTS xml_importado boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.nfe_distribuicao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nfe_distribuicao_id uuid NOT NULL REFERENCES public.nfe_distribuicao(id) ON DELETE CASCADE,
  numero_item integer NOT NULL,
  codigo text,
  descricao text NOT NULL,
  ncm text,
  cfop text,
  unidade text,
  quantidade numeric(15,4) NOT NULL DEFAULT 0,
  valor_unitario numeric(15,4) NOT NULL DEFAULT 0,
  valor_total numeric(15,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_nfe_dist_item_qtd CHECK (quantidade >= 0),
  CONSTRAINT chk_nfe_dist_item_valor CHECK (valor_total >= 0),
  UNIQUE (nfe_distribuicao_id, numero_item)
);

CREATE INDEX IF NOT EXISTS idx_nfe_dist_itens_dist ON public.nfe_distribuicao_itens(nfe_distribuicao_id);

ALTER TABLE public.nfe_distribuicao_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_nfe_dist_itens" ON public.nfe_distribuicao_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_nfe_dist_itens" ON public.nfe_distribuicao_itens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "admin_delete_nfe_dist_itens" ON public.nfe_distribuicao_itens FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));