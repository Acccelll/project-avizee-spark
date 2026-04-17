CREATE OR REPLACE FUNCTION public.salvar_orcamento(p_id uuid, p_payload jsonb, p_itens jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id UUID;
BEGIN
  IF p_id IS NOT NULL THEN
    UPDATE orcamentos SET
      numero=COALESCE(p_payload->>'numero',numero),
      cliente_id=(p_payload->>'cliente_id')::uuid,
      status=COALESCE(p_payload->>'status',status),
      data_orcamento=(p_payload->>'data_orcamento')::date,
      validade=(p_payload->>'validade')::date,
      observacoes=p_payload->>'observacoes',
      observacoes_internas=p_payload->>'observacoes_internas',
      desconto=COALESCE((p_payload->>'desconto')::numeric,0),
      imposto_st=COALESCE((p_payload->>'imposto_st')::numeric,0),
      imposto_ipi=COALESCE((p_payload->>'imposto_ipi')::numeric,0),
      frete_valor=COALESCE((p_payload->>'frete_valor')::numeric,0),
      outras_despesas=COALESCE((p_payload->>'outras_despesas')::numeric,0),
      valor_total=COALESCE((p_payload->>'valor_total')::numeric,0),
      quantidade_total=COALESCE((p_payload->>'quantidade_total')::numeric,0),
      peso_total=COALESCE((p_payload->>'peso_total')::numeric,0),
      pagamento=p_payload->>'pagamento',
      prazo_pagamento=p_payload->>'prazo_pagamento',
      prazo_entrega=p_payload->>'prazo_entrega',
      frete_tipo=p_payload->>'frete_tipo',
      modalidade=p_payload->>'modalidade',
      cliente_snapshot=COALESCE(p_payload->'cliente_snapshot', cliente_snapshot),
      transportadora_id=NULLIF(p_payload->>'transportadora_id','')::uuid,
      frete_simulacao_id=NULLIF(p_payload->>'frete_simulacao_id','')::uuid,
      origem_frete=p_payload->>'origem_frete',
      servico_frete=p_payload->>'servico_frete',
      prazo_entrega_dias=NULLIF(p_payload->>'prazo_entrega_dias','')::int,
      volumes=NULLIF(p_payload->>'volumes','')::int,
      altura_cm=NULLIF(p_payload->>'altura_cm','')::numeric,
      largura_cm=NULLIF(p_payload->>'largura_cm','')::numeric,
      comprimento_cm=NULLIF(p_payload->>'comprimento_cm','')::numeric,
      updated_at=now()
    WHERE id=p_id RETURNING id INTO v_id;
  ELSE
    INSERT INTO orcamentos(numero,cliente_id,status,data_orcamento,validade,observacoes,observacoes_internas,desconto,imposto_st,imposto_ipi,frete_valor,outras_despesas,valor_total,quantidade_total,peso_total,pagamento,prazo_pagamento,prazo_entrega,frete_tipo,modalidade,cliente_snapshot,transportadora_id,frete_simulacao_id,origem_frete,servico_frete,prazo_entrega_dias,volumes,altura_cm,largura_cm,comprimento_cm)
    VALUES(
      COALESCE(p_payload->>'numero', proximo_numero_orcamento()),
      (p_payload->>'cliente_id')::uuid,
      COALESCE(p_payload->>'status','rascunho'),
      (p_payload->>'data_orcamento')::date,
      (p_payload->>'validade')::date,
      p_payload->>'observacoes',
      p_payload->>'observacoes_internas',
      COALESCE((p_payload->>'desconto')::numeric,0),
      COALESCE((p_payload->>'imposto_st')::numeric,0),
      COALESCE((p_payload->>'imposto_ipi')::numeric,0),
      COALESCE((p_payload->>'frete_valor')::numeric,0),
      COALESCE((p_payload->>'outras_despesas')::numeric,0),
      COALESCE((p_payload->>'valor_total')::numeric,0),
      COALESCE((p_payload->>'quantidade_total')::numeric,0),
      COALESCE((p_payload->>'peso_total')::numeric,0),
      p_payload->>'pagamento',
      p_payload->>'prazo_pagamento',
      p_payload->>'prazo_entrega',
      p_payload->>'frete_tipo',
      p_payload->>'modalidade',
      p_payload->'cliente_snapshot',
      NULLIF(p_payload->>'transportadora_id','')::uuid,
      NULLIF(p_payload->>'frete_simulacao_id','')::uuid,
      p_payload->>'origem_frete',
      p_payload->>'servico_frete',
      NULLIF(p_payload->>'prazo_entrega_dias','')::int,
      NULLIF(p_payload->>'volumes','')::int,
      NULLIF(p_payload->>'altura_cm','')::numeric,
      NULLIF(p_payload->>'largura_cm','')::numeric,
      NULLIF(p_payload->>'comprimento_cm','')::numeric
    ) RETURNING id INTO v_id;
  END IF;

  DELETE FROM orcamentos_itens WHERE orcamento_id = v_id;
  IF p_itens IS NOT NULL AND jsonb_array_length(p_itens) > 0 THEN
    INSERT INTO orcamentos_itens(
      orcamento_id, produto_id, codigo_snapshot, descricao_snapshot, variacao,
      quantidade, unidade, valor_unitario, valor_total,
      peso_unitario, peso_total, custo_unitario
    )
    SELECT v_id,
      NULLIF(item->>'produto_id','')::uuid,
      COALESCE(item->>'codigo_snapshot',''),
      COALESCE(item->>'descricao_snapshot', item->>'descricao',''),
      COALESCE(item->>'variacao',''),
      COALESCE((item->>'quantidade')::numeric,0),
      COALESCE(item->>'unidade','UN'),
      COALESCE((item->>'valor_unitario')::numeric,0),
      COALESCE((item->>'valor_total')::numeric,0),
      COALESCE((item->>'peso_unitario')::numeric,0),
      COALESCE((item->>'peso_total')::numeric,0),
      NULLIF(item->>'custo_unitario','')::numeric
    FROM jsonb_array_elements(p_itens) AS item;
  END IF;

  RETURN v_id;
END;
$function$;