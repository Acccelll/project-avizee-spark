CREATE OR REPLACE FUNCTION public.reprocessar_cte_referencias_por_chave(p_chave text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_chave text := regexp_replace(COALESCE(p_chave,''),'\D','','g');
  v_ref record;
  v_nfe_id uuid;
  v_count integer := 0;
BEGIN
  IF length(v_chave) <> 44 THEN RETURN 0; END IF;

  FOR v_ref IN
    SELECT r.id, r.cte_id, r.empresa_id
      FROM public.cte_nfe_referencias r
     WHERE r.nfe_chave = v_chave
       AND (r.nfe_id IS NULL OR r.status_vinculo <> 'localizada')
     FOR UPDATE
  LOOP
    SELECT n.id INTO v_nfe_id
      FROM public.notas_fiscais n
     WHERE n.chave_acesso = v_chave
       AND n.empresa_id = v_ref.empresa_id
       AND n.tipo_documento IN ('nfe','nfce')
     ORDER BY n.created_at DESC
     LIMIT 1;

    IF v_nfe_id IS NOT NULL THEN
      UPDATE public.cte_nfe_referencias
         SET nfe_id = v_nfe_id,
             status_vinculo = 'localizada',
             updated_at = now()
       WHERE id = v_ref.id;
      v_count := v_count + 1;

      IF EXISTS (
        SELECT 1 FROM public.notas_fiscais
         WHERE id = v_ref.cte_id
           AND empresa_id = v_ref.empresa_id
           AND status = 'confirmada'
      ) THEN
        PERFORM public.aplicar_rateio_cte(v_ref.cte_id);
      END IF;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$function$;

-- Modelo 67 é sempre CT-e OS; modelo 57 é CT-e de cargas.
CREATE OR REPLACE FUNCTION public.salvar_documento_fiscal_completo(p_nf_id uuid,p_payload jsonb,p_itens jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_payload jsonb := COALESCE(p_payload,'{}'::jsonb);
  v_modelo text;
BEGIN
  v_modelo := NULLIF(TRIM(v_payload->>'modelo_documento'),'');
  IF v_modelo = '67' THEN
    v_payload := jsonb_set(v_payload,'{tipo_documento}','"cte_os"'::jsonb,true);
  ELSIF v_modelo = '57' AND COALESCE(v_payload->>'tipo_documento','') IN ('cte','cte_os') THEN
    v_payload := jsonb_set(v_payload,'{tipo_documento}','"cte"'::jsonb,true);
  END IF;

  v_id := public.salvar_nota_fiscal(p_nf_id,v_payload,p_itens);
  PERFORM public.salvar_metadados_documento_fiscal(v_id,v_payload);
  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.salvar_documento_fiscal_completo(uuid,jsonb,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reprocessar_cte_referencias_por_chave(text) TO authenticated;
