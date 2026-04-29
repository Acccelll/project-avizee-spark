CREATE OR REPLACE FUNCTION public.importar_nfe_entrada(p_payload jsonb, p_empresa_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_emit          jsonb := p_payload->'emitente';
  v_nota          jsonb := p_payload->'nota';
  v_itens         jsonb := coalesce(p_payload->'itens', '[]'::jsonb);
  v_cnpj          text;
  v_chave         text;
  v_numero        text;
  v_serie         text;
  v_modelo        text;
  v_fornecedor_id uuid;
  v_fornecedor_criado boolean := false;
  v_nota_id       uuid;
  v_nota_atualizada boolean := false;
  v_itens_inseridos int := 0;
  v_item          jsonb;
  v_empresa       uuid;
  v_origem        text;
BEGIN
  PERFORM set_config('app.nf_internal_op', '1', true);

  v_empresa := coalesce(
    p_empresa_id,
    (SELECT public.current_empresa_id()),
    (SELECT id FROM public.empresas ORDER BY created_at LIMIT 1)
  );
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Nenhuma empresa configurada');
  END IF;

  v_numero := nullif(trim(v_nota->>'numero'), '');
  IF v_numero IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Número da nota obrigatório');
  END IF;

  v_serie  := coalesce(nullif(trim(v_nota->>'serie'), ''), '1');
  v_modelo := coalesce(nullif(trim(v_nota->>'modelo_documento'), ''), '55');
  v_chave  := nullif(regexp_replace(coalesce(v_nota->>'chave_acesso',''), '\D', '', 'g'), '');
  IF v_chave IS NOT NULL AND length(v_chave) <> 44 THEN
    v_chave := NULL;
  END IF;
  v_origem := coalesce(nullif(trim(v_nota->>'origem'),''), 'xml_importado');
  IF v_origem NOT IN ('manual','xml_importado','pedido','devolucao','importacao_historica','sefaz_externa') THEN
    v_origem := 'xml_importado';
  END IF;

  v_cnpj := nullif(regexp_replace(coalesce(v_emit->>'cnpj',''), '\D', '', 'g'), '');

  IF v_cnpj IS NOT NULL AND length(v_cnpj) IN (11,14) THEN
    SELECT id INTO v_fornecedor_id
    FROM public.fornecedores
    WHERE regexp_replace(coalesce(cpf_cnpj,''), '\D', '', 'g') = v_cnpj
    LIMIT 1;

    IF v_fornecedor_id IS NULL THEN
      INSERT INTO public.fornecedores (
        empresa_id, tipo_pessoa, nome_razao_social, nome_fantasia, cpf_cnpj,
        inscricao_estadual, uf, cidade, ativo, origem
      ) VALUES (
        v_empresa,
        CASE WHEN length(v_cnpj) = 14 THEN 'J' ELSE 'F' END,
        coalesce(nullif(trim(v_emit->>'razao_social'), ''), 'FORNECEDOR ' || v_cnpj),
        nullif(trim(v_emit->>'nome_fantasia'), ''),
        v_cnpj,
        nullif(trim(v_emit->>'inscricao_estadual'), ''),
        nullif(trim(v_emit->>'uf'), ''),
        nullif(trim(v_emit->>'cidade'), ''),
        true,
        'import_xml_entrada'
      )
      RETURNING id INTO v_fornecedor_id;
      v_fornecedor_criado := true;
    END IF;
  ELSE
    SELECT id INTO v_fornecedor_id
    FROM public.fornecedores
    WHERE nome_razao_social = 'FORNECEDOR DESCONHECIDO (importação)'
    LIMIT 1;

    IF v_fornecedor_id IS NULL THEN
      INSERT INTO public.fornecedores (
        empresa_id, tipo_pessoa, nome_razao_social, ativo, origem, observacoes
      ) VALUES (
        v_empresa, 'J', 'FORNECEDOR DESCONHECIDO (importação)', true, 'import_xml_entrada',
        'Auto-criado para notas de entrada sem CNPJ identificável'
      )
      RETURNING id INTO v_fornecedor_id;
      v_fornecedor_criado := true;
    END IF;
  END IF;

  IF v_chave IS NOT NULL THEN
    SELECT id INTO v_nota_id FROM public.notas_fiscais WHERE chave_acesso = v_chave LIMIT 1;
  ELSE
    SELECT id INTO v_nota_id FROM public.notas_fiscais
    WHERE numero = v_numero AND serie = v_serie
      AND fornecedor_id = v_fornecedor_id
      AND modelo_documento = v_modelo
      AND coalesce(tipo_operacao,'entrada') = 'entrada'
    LIMIT 1;
  END IF;

  IF v_nota_id IS NULL THEN
    INSERT INTO public.notas_fiscais (
      empresa_id, tipo, tipo_operacao, modelo_documento, numero, serie, chave_acesso,
      data_emissao, fornecedor_id, natureza_operacao,
      valor_total, valor_produtos, frete_valor, desconto_valor, outras_despesas,
      icms_valor, ipi_valor, pis_valor, cofins_valor, icms_st_valor, valor_seguro,
      status, status_sefaz, ambiente_emissao, finalidade_nfe,
      movimenta_estoque, gera_financeiro, origem, observacoes
    ) VALUES (
      v_empresa, 'entrada', 'entrada', v_modelo, v_numero, v_serie, v_chave,
      coalesce((v_nota->>'data_emissao')::date, CURRENT_DATE),
      v_fornecedor_id,
      nullif(trim(v_nota->>'natureza_operacao'), ''),
      coalesce((v_nota->>'valor_total')::numeric, 0),
      coalesce((v_nota->>'valor_produtos')::numeric, 0),
      coalesce((v_nota->>'frete_valor')::numeric, 0),
      coalesce((v_nota->>'desconto_valor')::numeric, 0),
      coalesce((v_nota->>'outras_despesas')::numeric, 0),
      coalesce((v_nota->>'icms_valor')::numeric, 0),
      coalesce((v_nota->>'ipi_valor')::numeric, 0),
      coalesce((v_nota->>'pis_valor')::numeric, 0),
      coalesce((v_nota->>'cofins_valor')::numeric, 0),
      coalesce((v_nota->>'icms_st_valor')::numeric, 0),
      coalesce((v_nota->>'valor_seguro')::numeric, 0),
      coalesce(nullif(trim(v_nota->>'status'),''), 'importada'),
      'importada_externa', 'producao', 'normal',
      coalesce((v_nota->>'movimenta_estoque')::boolean, false),
      coalesce((v_nota->>'gera_financeiro')::boolean, false),
      v_origem,
      nullif(trim(v_nota->>'observacoes'), '')
    )
    RETURNING id INTO v_nota_id;
  ELSE
    UPDATE public.notas_fiscais SET
      tipo              = coalesce(tipo, 'entrada'),
      tipo_operacao     = 'entrada',
      fornecedor_id     = coalesce(fornecedor_id, v_fornecedor_id),
      modelo_documento  = coalesce(modelo_documento, v_modelo),
      data_emissao      = coalesce(data_emissao, (v_nota->>'data_emissao')::date),
      natureza_operacao = coalesce(nullif(natureza_operacao,''), nullif(trim(v_nota->>'natureza_operacao'),'')),
      valor_total       = CASE WHEN coalesce(valor_total,0)=0 THEN coalesce((v_nota->>'valor_total')::numeric, valor_total) ELSE valor_total END,
      valor_produtos    = CASE WHEN coalesce(valor_produtos,0)=0 THEN coalesce((v_nota->>'valor_produtos')::numeric, valor_produtos) ELSE valor_produtos END,
      frete_valor       = CASE WHEN coalesce(frete_valor,0)=0 THEN coalesce((v_nota->>'frete_valor')::numeric, frete_valor) ELSE frete_valor END,
      desconto_valor    = CASE WHEN coalesce(desconto_valor,0)=0 THEN coalesce((v_nota->>'desconto_valor')::numeric, desconto_valor) ELSE desconto_valor END,
      icms_valor        = CASE WHEN coalesce(icms_valor,0)=0 THEN coalesce((v_nota->>'icms_valor')::numeric, icms_valor) ELSE icms_valor END,
      ipi_valor         = CASE WHEN coalesce(ipi_valor,0)=0 THEN coalesce((v_nota->>'ipi_valor')::numeric, ipi_valor) ELSE ipi_valor END,
      pis_valor         = CASE WHEN coalesce(pis_valor,0)=0 THEN coalesce((v_nota->>'pis_valor')::numeric, pis_valor) ELSE pis_valor END,
      cofins_valor      = CASE WHEN coalesce(cofins_valor,0)=0 THEN coalesce((v_nota->>'cofins_valor')::numeric, cofins_valor) ELSE cofins_valor END,
      icms_st_valor     = CASE WHEN coalesce(icms_st_valor,0)=0 THEN coalesce((v_nota->>'icms_st_valor')::numeric, icms_st_valor) ELSE icms_st_valor END,
      chave_acesso      = coalesce(chave_acesso, v_chave),
      origem            = coalesce(nullif(origem,''), v_origem),
      empresa_id        = coalesce(empresa_id, v_empresa),
      status_sefaz      = CASE WHEN status='importada' AND coalesce(status_sefaz,'') <> 'importada_externa' THEN 'importada_externa' ELSE status_sefaz END,
      updated_at        = now()
    WHERE id = v_nota_id;
    v_nota_atualizada := true;
  END IF;

  IF jsonb_array_length(v_itens) > 0 AND NOT EXISTS (
    SELECT 1 FROM public.notas_fiscais_itens WHERE nota_fiscal_id = v_nota_id
  ) THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_itens) LOOP
      INSERT INTO public.notas_fiscais_itens (
        nota_fiscal_id, codigo_produto, descricao, ncm, cfop, unidade,
        quantidade, valor_unitario, valor_total,
        cest, cst, origem_migracao
      ) VALUES (
        v_nota_id,
        nullif(trim(v_item->>'codigo'), ''),
        nullif(trim(v_item->>'descricao'), ''),
        nullif(trim(v_item->>'ncm'), ''),
        nullif(trim(v_item->>'cfop'), ''),
        nullif(trim(v_item->>'unidade'), ''),
        coalesce((v_item->>'quantidade')::numeric, 0),
        coalesce((v_item->>'valor_unitario')::numeric, 0),
        coalesce((v_item->>'valor_total')::numeric, 0),
        nullif(trim(v_item->>'cest'), ''),
        nullif(trim(v_item->>'cst'), ''),
        'xml_entrada'
      );
      v_itens_inseridos := v_itens_inseridos + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'nota_id', v_nota_id,
    'fornecedor_id', v_fornecedor_id,
    'fornecedor_criado', v_fornecedor_criado,
    'nota_atualizada', v_nota_atualizada,
    'itens_inseridos', v_itens_inseridos,
    'chave_acesso', v_chave
  );
END;
$function$;