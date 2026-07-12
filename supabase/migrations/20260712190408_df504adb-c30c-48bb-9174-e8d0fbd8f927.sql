
CREATE OR REPLACE FUNCTION public.financeiro_gerar_titulos_de_nota_importada(p_nota_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_nf record;
  v_parc jsonb;
  v_idx int := 0;
  v_total int;
  v_vcto date;
  v_valor numeric;
  v_tipo text;
  v_forma text;
  v_partner_id uuid;
  v_gerados int := 0;
BEGIN
  SELECT nf.id, nf.tipo, nf.status, nf.numero, nf.chave_acesso, nf.data_emissao,
         nf.data_vencimento, nf.valor_total, nf.numero_parcelas, nf.parcelas,
         nf.forma_pagamento, nf.condicao_pagamento, nf.cliente_id, nf.fornecedor_id,
         nf.empresa_id
    INTO v_nf FROM public.notas_fiscais nf WHERE nf.id = p_nota_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Nota fiscal % não encontrada', p_nota_id; END IF;
  IF v_nf.status <> 'importada' THEN RETURN 0; END IF;
  IF EXISTS (SELECT 1 FROM public.financeiro_lancamentos
              WHERE nota_fiscal_id = p_nota_id AND ativo = true) THEN RETURN 0; END IF;

  IF v_nf.tipo = 'entrada' THEN
    v_tipo := 'pagar';  v_partner_id := v_nf.fornecedor_id;
  ELSIF v_nf.tipo = 'saida' THEN
    v_tipo := 'receber'; v_partner_id := v_nf.cliente_id;
  ELSE RETURN 0; END IF;

  v_forma := COALESCE(NULLIF(v_nf.forma_pagamento, ''),
             CASE WHEN v_tipo='pagar' THEN 'boleto_dda' ELSE 'boleto' END);

  IF v_nf.parcelas IS NOT NULL AND jsonb_typeof(v_nf.parcelas)='array'
     AND jsonb_array_length(v_nf.parcelas) > 0 THEN
    v_total := jsonb_array_length(v_nf.parcelas);
    FOR v_parc IN SELECT * FROM jsonb_array_elements(v_nf.parcelas) LOOP
      v_idx := v_idx + 1;
      v_vcto := COALESCE(
        (v_parc->>'vencimento')::date, (v_parc->>'data_vencimento')::date,
        v_nf.data_vencimento,
        CASE WHEN v_nf.condicao_pagamento='a_vista' THEN v_nf.data_emissao
             ELSE v_nf.data_emissao + INTERVAL '30 days' END);
      v_valor := COALESCE((v_parc->>'valor')::numeric, v_nf.valor_total / v_total);
      INSERT INTO public.financeiro_lancamentos (
        tipo, descricao, titulo, valor, data_vencimento, data_emissao, status,
        forma_pagamento, cliente_id, fornecedor_id, nota_fiscal_id, empresa_id,
        parcela_numero, parcela_total,
        origem_tipo, origem_tabela, origem_id, origem_descricao, ativo
      ) VALUES (
        v_tipo,
        'NF ' || COALESCE(v_nf.numero,'?') || ' - parcela ' || v_idx || '/' || v_total,
        'NF ' || COALESCE(v_nf.numero,'?'),
        v_valor, v_vcto, v_nf.data_emissao, 'aberto', v_forma,
        CASE WHEN v_tipo='receber' THEN v_partner_id END,
        CASE WHEN v_tipo='pagar'   THEN v_partner_id END,
        v_nf.id, v_nf.empresa_id, v_idx, v_total,
        'fiscal_nota', 'notas_fiscais', v_nf.id,
        'NF ' || COALESCE(v_nf.numero,'') || COALESCE(' / chave '||v_nf.chave_acesso,''),
        true);
      v_gerados := v_gerados + 1;
    END LOOP;
  ELSE
    v_total := GREATEST(COALESCE(v_nf.numero_parcelas, 1), 1);
    v_vcto := COALESCE(v_nf.data_vencimento,
      CASE WHEN v_nf.condicao_pagamento='a_vista' THEN v_nf.data_emissao
           ELSE v_nf.data_emissao + INTERVAL '30 days' END);
    FOR v_idx IN 1..v_total LOOP
      INSERT INTO public.financeiro_lancamentos (
        tipo, descricao, titulo, valor, data_vencimento, data_emissao, status,
        forma_pagamento, cliente_id, fornecedor_id, nota_fiscal_id, empresa_id,
        parcela_numero, parcela_total,
        origem_tipo, origem_tabela, origem_id, origem_descricao, ativo
      ) VALUES (
        v_tipo,
        'NF ' || COALESCE(v_nf.numero,'?') || ' - parcela ' || v_idx || '/' || v_total,
        'NF ' || COALESCE(v_nf.numero,'?'),
        ROUND(v_nf.valor_total / v_total, 2),
        v_vcto + ((v_idx - 1) * INTERVAL '30 days'),
        v_nf.data_emissao, 'aberto', v_forma,
        CASE WHEN v_tipo='receber' THEN v_partner_id END,
        CASE WHEN v_tipo='pagar'   THEN v_partner_id END,
        v_nf.id, v_nf.empresa_id, v_idx, v_total,
        'fiscal_nota', 'notas_fiscais', v_nf.id,
        'NF ' || COALESCE(v_nf.numero,'') || COALESCE(' / chave '||v_nf.chave_acesso,''),
        true);
      v_gerados := v_gerados + 1;
    END LOOP;
  END IF;

  RETURN v_gerados;
END;
$$;

GRANT EXECUTE ON FUNCTION public.financeiro_gerar_titulos_de_nota_importada(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.financeiro_backfill_importadas_pos_uso(
  p_data_corte date DEFAULT DATE '2026-04-01'
) RETURNS TABLE(out_nota_id uuid, out_numero text, out_lancamentos integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; v_qtd int;
BEGIN
  FOR r IN
    SELECT nf.id AS id, nf.numero AS numero FROM public.notas_fiscais nf
     WHERE nf.status='importada' AND nf.data_emissao >= p_data_corte
       AND nf.tipo IN ('entrada','saida')
       AND NOT EXISTS (SELECT 1 FROM public.financeiro_lancamentos fl
                        WHERE fl.nota_fiscal_id = nf.id AND fl.ativo = true)
     ORDER BY nf.data_emissao
  LOOP
    v_qtd := public.financeiro_gerar_titulos_de_nota_importada(r.id);
    out_nota_id := r.id; out_numero := r.numero; out_lancamentos := v_qtd;
    RETURN NEXT;
  END LOOP;
END; $$;

GRANT EXECUTE ON FUNCTION public.financeiro_backfill_importadas_pos_uso(date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_nf_importada_gera_financeiro_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status='importada' AND NEW.data_emissao >= DATE '2026-04-01'
     AND NEW.tipo IN ('entrada','saida') THEN
    PERFORM public.financeiro_gerar_titulos_de_nota_importada(NEW.id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_nf_importada_gera_financeiro ON public.notas_fiscais;
CREATE TRIGGER trg_nf_importada_gera_financeiro
AFTER INSERT OR UPDATE OF status ON public.notas_fiscais
FOR EACH ROW EXECUTE FUNCTION public.trg_nf_importada_gera_financeiro_fn();

SELECT * FROM public.financeiro_backfill_importadas_pos_uso();
