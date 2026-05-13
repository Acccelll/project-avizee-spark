
-- 1) Atualizar CHECK de tipo_item em produtos para aceitar 'servico'
ALTER TABLE public.produtos
  DROP CONSTRAINT IF EXISTS produtos_tipo_item_check;
ALTER TABLE public.produtos
  ADD CONSTRAINT produtos_tipo_item_check
  CHECK (tipo_item IN ('produto','insumo','servico'));

-- 2) Sequence + função de código interno com SRV
CREATE SEQUENCE IF NOT EXISTS public.seq_codigo_interno_servico START 1;

CREATE OR REPLACE FUNCTION public.proximo_codigo_interno(_tipo text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n bigint;
  _prefix text;
BEGIN
  IF _tipo = 'produto' THEN
    _prefix := 'PRD';
    _n := nextval('public.seq_codigo_interno_produto');
  ELSIF _tipo = 'insumo' THEN
    _prefix := 'INS';
    _n := nextval('public.seq_codigo_interno_insumo');
  ELSIF _tipo = 'servico' THEN
    _prefix := 'SRV';
    _n := nextval('public.seq_codigo_interno_servico');
  ELSE
    RAISE EXCEPTION 'tipo_item inválido: %, esperado produto|insumo|servico', _tipo;
  END IF;
  RETURN _prefix || lpad(_n::text, 6, '0');
END;
$$;

-- 3) Campos opcionais de tributação ISS em produtos
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS codigo_servico_lc116        text,
  ADD COLUMN IF NOT EXISTS codigo_tributacao_municipio text,
  ADD COLUMN IF NOT EXISTS aliquota_iss                numeric(5,4),
  ADD COLUMN IF NOT EXISTS retencao_iss                boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS tipo_tributacao_iss         integer;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_produtos_aliquota_iss') THEN
    ALTER TABLE public.produtos
      ADD CONSTRAINT chk_produtos_aliquota_iss
      CHECK (aliquota_iss IS NULL OR (aliquota_iss >= 0 AND aliquota_iss <= 1));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_produtos_tipo_tributacao_iss') THEN
    ALTER TABLE public.produtos
      ADD CONSTRAINT chk_produtos_tipo_tributacao_iss
      CHECK (tipo_tributacao_iss IS NULL OR tipo_tributacao_iss BETWEEN 1 AND 6);
  END IF;
END $$;

-- 4) Remover servico_id em itens de NF e DROP da tabela servicos
ALTER TABLE public.notas_fiscais_itens
  DROP COLUMN IF EXISTS servico_id;

DROP TABLE IF EXISTS public.servicos CASCADE;
