-- RPC: gerar_financeiro_nfe_saida
-- Espelho de gerar_financeiro_nfe_entrada para NFs de SAÍDA importadas via XML.
-- Cria lançamentos a RECEBER vinculados ao cliente da NF.

DROP FUNCTION IF EXISTS public.gerar_financeiro_nfe_saida(uuid, jsonb, text);

CREATE OR REPLACE FUNCTION public.gerar_financeiro_nfe_saida(
  p_nota_id uuid,
  p_duplicatas jsonb,
  p_forma_pagamento text DEFAULT 'boleto'
)
RETURNS TABLE(lancamento_id uuid, parcela integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nota record;
  v_total int;
  v_dup jsonb;
  v_idx int := 0;
  v_id uuid;
  v_vcto date;
  v_forma text;
BEGIN
  SELECT id, cliente_id, numero, chave_acesso
    INTO v_nota
    FROM public.notas_fiscais
   WHERE id = p_nota_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nota fiscal % nao encontrada', p_nota_id;
  END IF;

  IF p_duplicatas IS NULL OR jsonb_array_length(p_duplicatas) = 0 THEN
    RETURN;
  END IF;

  v_total := jsonb_array_length(p_duplicatas);
  v_forma := COALESCE(p_forma_pagamento, 'boleto');

  FOR v_dup IN SELECT * FROM jsonb_array_elements(p_duplicatas) LOOP
    v_idx := v_idx + 1;
    v_vcto := (v_dup->>'vencimento')::date;

    BEGIN
      INSERT INTO public.financeiro_lancamentos (
        tipo, descricao, valor, data_vencimento, status,
        forma_pagamento, cliente_id, nota_fiscal_id,
        parcela_numero, parcela_total,
        origem_tipo, origem_tabela, origem_id, origem_descricao,
        ativo, data_emissao
      ) VALUES (
        'receber',
        'NF-e ' || COALESCE(v_nota.numero,'?') || ' - parcela ' || v_idx || '/' || v_total,
        (v_dup->>'valor')::numeric,
        v_vcto,
        'aberto',
        v_forma,
        v_nota.cliente_id,
        v_nota.id,
        v_idx, v_total,
        'fiscal_nota', 'notas_fiscais', v_nota.id,
        'NF-e ' || COALESCE(v_nota.numero,'') || COALESCE(' / chave ' || v_nota.chave_acesso, ''),
        true,
        CURRENT_DATE
      ) RETURNING id INTO v_id;

      lancamento_id := v_id;
      parcela := v_idx;
      RETURN NEXT;
    EXCEPTION WHEN unique_violation THEN
      CONTINUE;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.gerar_financeiro_nfe_saida(uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gerar_financeiro_nfe_saida(uuid, jsonb, text) TO authenticated;