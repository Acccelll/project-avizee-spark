DO $$
DECLARE
  v_empresa uuid;
  v_lithium uuid;
BEGIN
  SELECT id INTO v_empresa FROM public.empresas ORDER BY created_at LIMIT 1;

  SELECT id INTO v_lithium FROM public.fornecedores
   WHERE regexp_replace(coalesce(cpf_cnpj,''),'\D','','g')='05009138000175' LIMIT 1;

  IF v_lithium IS NULL THEN
    INSERT INTO public.fornecedores (empresa_id, tipo_pessoa, nome_razao_social, cpf_cnpj, uf, cidade, ativo, origem)
    VALUES (v_empresa, 'J', 'LITHIUM SOFTWARE LTDA', '05009138000175', 'SP', 'Birigui', true, 'import_xml_entrada')
    RETURNING id INTO v_lithium;
  END IF;

  PERFORM set_config('app.nf_internal_op','1', true);

  UPDATE public.notas_fiscais
     SET fornecedor_id = v_lithium,
         updated_at = now()
   WHERE tipo_operacao = 'entrada'
     AND modelo_documento = '00'
     AND serie = '1'
     AND numero IN ('856100','839374','862499','849625','818091','829392')
     AND fornecedor_id IN (SELECT id FROM public.fornecedores WHERE nome_razao_social = 'FORNECEDOR DESCONHECIDO (importação)');
END $$;