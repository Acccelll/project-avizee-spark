CREATE SEQUENCE IF NOT EXISTS public.nfe_numero_seq
  START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1;

CREATE OR REPLACE FUNCTION public.proximo_numero_nfe(p_serie text DEFAULT '1')
RETURNS TABLE(numero bigint, serie text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_num bigint;
BEGIN
  v_num := nextval('public.nfe_numero_seq');
  UPDATE public.empresa_config SET proximo_numero_nfe = v_num + 1;
  RETURN QUERY SELECT v_num, p_serie;
END;
$$;
GRANT EXECUTE ON FUNCTION public.proximo_numero_nfe(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.calcular_dv_chave_nfe(p_chave43 text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public
AS $$
DECLARE
  v_pesos int[] := ARRAY[2,3,4,5,6,7,8,9];
  v_soma int := 0; v_idx int := 1; v_resto int; v_dv int; v_pos int;
BEGIN
  IF length(p_chave43) <> 43 THEN
    RAISE EXCEPTION 'Chave parcial deve ter 43 dígitos (recebido: %).', length(p_chave43);
  END IF;
  FOR v_pos IN REVERSE 43..1 LOOP
    v_soma := v_soma + (substring(p_chave43 FROM v_pos FOR 1)::int)
                       * v_pesos[((v_idx - 1) % 8) + 1];
    v_idx := v_idx + 1;
  END LOOP;
  v_resto := v_soma % 11;
  v_dv := 11 - v_resto;
  IF v_dv >= 10 THEN v_dv := 0; END IF;
  RETURN v_dv::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.gerar_chave_acesso_nfe(p_nf_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uf text; v_cnpj text; v_aamm text; v_modelo text; v_serie text;
  v_numero text; v_tp_emis text := '1'; v_cnf text;
  v_chave43 text; v_dv text; v_uf_codigo text; v_data timestamptz;
BEGIN
  SELECT uf, cnpj INTO v_uf, v_cnpj FROM public.empresa_config LIMIT 1;
  IF v_uf IS NULL OR v_cnpj IS NULL THEN
    RAISE EXCEPTION 'Empresa emitente sem UF ou CNPJ configurado.';
  END IF;
  SELECT
    COALESCE(modelo_documento, '55'),
    COALESCE(serie, '1'),
    COALESCE(numero, '0'),
    COALESCE(data_emissao, CURRENT_DATE)::timestamptz
   INTO v_modelo, v_serie, v_numero, v_data
   FROM public.notas_fiscais WHERE id = p_nf_id;
  IF v_numero = '0' OR v_numero IS NULL THEN
    RAISE EXCEPTION 'NF % sem número definido — chame proximo_numero_nfe antes.', p_nf_id;
  END IF;
  v_uf_codigo := CASE upper(v_uf)
    WHEN 'AC' THEN '12' WHEN 'AL' THEN '27' WHEN 'AP' THEN '16' WHEN 'AM' THEN '13'
    WHEN 'BA' THEN '29' WHEN 'CE' THEN '23' WHEN 'DF' THEN '53' WHEN 'ES' THEN '32'
    WHEN 'GO' THEN '52' WHEN 'MA' THEN '21' WHEN 'MT' THEN '51' WHEN 'MS' THEN '50'
    WHEN 'MG' THEN '31' WHEN 'PA' THEN '15' WHEN 'PB' THEN '25' WHEN 'PR' THEN '41'
    WHEN 'PE' THEN '26' WHEN 'PI' THEN '22' WHEN 'RJ' THEN '33' WHEN 'RN' THEN '24'
    WHEN 'RS' THEN '43' WHEN 'RO' THEN '11' WHEN 'RR' THEN '14' WHEN 'SC' THEN '42'
    WHEN 'SP' THEN '35' WHEN 'SE' THEN '28' WHEN 'TO' THEN '17'
    ELSE NULL END;
  IF v_uf_codigo IS NULL THEN
    RAISE EXCEPTION 'UF emitente "%" inválida.', v_uf;
  END IF;
  v_aamm := to_char(v_data, 'YYMM');
  v_cnf := lpad((floor(random() * 99999999))::int::text, 8, '0');
  IF v_cnf = lpad(v_numero, 8, '0') THEN
    v_cnf := lpad(((v_cnf::int + 1) % 100000000)::text, 8, '0');
  END IF;
  v_chave43 :=
    v_uf_codigo || v_aamm
    || lpad(regexp_replace(v_cnpj, '\D', '', 'g'), 14, '0')
    || lpad(v_modelo, 2, '0') || lpad(v_serie, 3, '0')
    || lpad(v_numero, 9, '0') || v_tp_emis || v_cnf;
  v_dv := public.calcular_dv_chave_nfe(v_chave43);
  RETURN v_chave43 || v_dv;
END;
$$;
GRANT EXECUTE ON FUNCTION public.gerar_chave_acesso_nfe(uuid) TO authenticated;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS codigo_ibge_municipio text,
  ADD COLUMN IF NOT EXISTS municipio_nome text;

ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS codigo_ibge_municipio text,
  ADD COLUMN IF NOT EXISTS municipio_nome text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notas_fiscais_emp_mod_ser_num
  ON public.notas_fiscais (empresa_id, modelo_documento, serie, numero)
  WHERE empresa_id IS NOT NULL
    AND modelo_documento IS NOT NULL
    AND serie IS NOT NULL
    AND numero IS NOT NULL
    AND status <> 'cancelada';

ALTER TABLE public.notas_fiscais
  DROP CONSTRAINT IF EXISTS chk_notas_fiscais_status_sefaz;

ALTER TABLE public.notas_fiscais
  ADD CONSTRAINT chk_notas_fiscais_status_sefaz
  CHECK (status_sefaz IS NULL OR status_sefaz IN (
    'nao_enviada','em_processamento','aguardando_protocolo',
    'autorizada','rejeitada','cancelada_sefaz','denegada','inutilizada',
    'importada_externa'
  ));

DO $$
DECLARE v_max bigint;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(numero, '\D', '', 'g'), '')::bigint), 0)
    INTO v_max FROM public.notas_fiscais WHERE numero IS NOT NULL;
  IF v_max > 0 THEN PERFORM setval('public.nfe_numero_seq', v_max, true); END IF;
END$$;