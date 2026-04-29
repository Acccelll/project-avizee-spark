-- Fase 2: Sigla de grupo + numeração atômica de SKU + ref. de pedido do cliente

ALTER TABLE public.grupos_produto ADD COLUMN IF NOT EXISTS sigla TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_grupos_produto_sigla ON public.grupos_produto(sigla) WHERE sigla IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.grupos_produto_sku_seq (
  grupo_id uuid PRIMARY KEY REFERENCES public.grupos_produto(id) ON DELETE CASCADE,
  ultimo_numero int NOT NULL DEFAULT 0
);
ALTER TABLE public.grupos_produto_sku_seq ENABLE ROW LEVEL SECURITY;
-- Sem políticas: tabela só é tocada via RPC SECURITY DEFINER (clientes anon/authenticated não conseguem ler/escrever).

CREATE OR REPLACE FUNCTION public.proximo_sku_grupo(_grupo_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sigla text;
  v_num int;
BEGIN
  SELECT sigla INTO v_sigla FROM public.grupos_produto WHERE id = _grupo_id;
  IF v_sigla IS NULL OR length(trim(v_sigla)) = 0 THEN
    RAISE EXCEPTION 'Grupo % sem sigla configurada — defina a sigla em Cadastros > Grupos.', _grupo_id;
  END IF;

  INSERT INTO public.grupos_produto_sku_seq(grupo_id, ultimo_numero)
  VALUES (_grupo_id, 1)
  ON CONFLICT (grupo_id) DO UPDATE
    SET ultimo_numero = public.grupos_produto_sku_seq.ultimo_numero + 1
  RETURNING ultimo_numero INTO v_num;

  RETURN upper(v_sigla) || lpad(v_num::text, 3, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.proximo_sku_grupo(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.inicializar_seq_sku_grupo(_grupo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sigla text;
  v_max int;
BEGIN
  SELECT sigla INTO v_sigla FROM public.grupos_produto WHERE id = _grupo_id;
  IF v_sigla IS NULL THEN RETURN; END IF;

  SELECT COALESCE(MAX( (regexp_replace(sku, '^' || upper(v_sigla) || '0*', ''))::int ), 0)
  INTO v_max
  FROM public.produtos
  WHERE grupo_id = _grupo_id
    AND sku ~ ('^' || upper(v_sigla) || '[0-9]+$');

  INSERT INTO public.grupos_produto_sku_seq(grupo_id, ultimo_numero)
  VALUES (_grupo_id, v_max)
  ON CONFLICT (grupo_id) DO UPDATE SET ultimo_numero = GREATEST(public.grupos_produto_sku_seq.ultimo_numero, v_max);
END;
$$;

GRANT EXECUTE ON FUNCTION public.inicializar_seq_sku_grupo(uuid) TO authenticated;

-- Referência opcional de pedido do cliente nas Ordens de Venda
ALTER TABLE public.ordens_venda ADD COLUMN IF NOT EXISTS pedido_cliente_ref TEXT;
COMMENT ON COLUMN public.ordens_venda.pedido_cliente_ref IS 'Número/PO do pedido informado pelo cliente — opcional, exibido na emissão de NF-e.';