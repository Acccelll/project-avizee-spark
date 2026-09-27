-- Pedido direto (sem orçamento prévio) e numeração segura do orçamento.
--
-- 1. Numeração: o número do orçamento passa a ser sempre gerado pelo banco
--    ao inserir. Antes a tela mostrava o "próximo número" e gravava esse
--    valor; duas pessoas abrindo "Novo orçamento" ao mesmo tempo recebiam o
--    mesmo número. Revisões ("ORC100268.1") não entram mais no máximo.
-- 2. Canal de venda do pedido (orçamento, WhatsApp, Mercado Livre, e-mail/OC,
--    telefone).
-- 3. criar_pedido_direto: cria orçamento + itens já como Pedido.
-- 4. Vínculo NF ↔ pedido do Mercado Livre pelo nº da venda, mesmo quando o
--    destinatário da nota não bate com o cliente cadastrado.

-- 1. Numeração ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.proximo_numero_orcamento()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_existing bigint;
  v_seq_current bigint;
  v_next bigint;
BEGIN
  -- Serializa a geração: sem o lock, duas transações podiam ressincronizar a
  -- sequence para o mesmo valor e devolver o mesmo número.
  PERFORM pg_advisory_xact_lock(hashtext('public.seq_orcamento'));

  -- Só números simples (ORC000123); revisões "ORC000123.1" ficam de fora.
  SELECT COALESCE(MAX(SUBSTRING(numero FROM 4)::bigint), 0)
    INTO v_max_existing
    FROM public.orcamentos
   WHERE numero ~ '^ORC[0-9]+$';

  SELECT COALESCE(last_value, 0) INTO v_seq_current FROM public.seq_orcamento;
  IF v_max_existing > v_seq_current THEN
    PERFORM setval('public.seq_orcamento', v_max_existing, true);
  END IF;

  v_next := nextval('public.seq_orcamento');
  RETURN 'ORC' || LPAD(v_next::text, 6, '0');
END;
$$;

-- salvar_orcamento: o número é do banco. Na criação ignora o que vier no
-- payload; na edição não troca o número.
CREATE OR REPLACE FUNCTION public.salvar_orcamento(p_id uuid, p_payload jsonb, p_itens jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  IF p_id IS NOT NULL THEN
    UPDATE orcamentos SET
      cliente_id=(p_payload->>'cliente_id')::uuid,
      status=COALESCE(NULLIF(p_payload->>'status',''),status),
      data_orcamento=(p_payload->>'data_orcamento')::date,
      validade=NULLIF(p_payload->>'validade','')::date,
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
      pagamento=NULLIF(p_payload->>'pagamento',''),
      prazo_pagamento=p_payload->>'prazo_pagamento',
      prazo_entrega=p_payload->>'prazo_entrega',
      frete_tipo=NULLIF(p_payload->>'frete_tipo',''),
      modalidade=NULLIF(p_payload->>'modalidade',''),
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
      proximo_numero_orcamento(),
      (p_payload->>'cliente_id')::uuid,
      COALESCE(NULLIF(p_payload->>'status',''),'rascunho'),
      (p_payload->>'data_orcamento')::date,
      NULLIF(p_payload->>'validade','')::date,
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
      NULLIF(p_payload->>'pagamento',''),
      p_payload->>'prazo_pagamento',
      p_payload->>'prazo_entrega',
      NULLIF(p_payload->>'frete_tipo',''),
      NULLIF(p_payload->>'modalidade',''),
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
$$;

-- 2. Canal de venda ----------------------------------------------------------------
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS canal text NOT NULL DEFAULT 'orcamento';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orcamentos_canal_check') THEN
    ALTER TABLE public.orcamentos
      ADD CONSTRAINT orcamentos_canal_check
      CHECK (canal IN ('orcamento', 'whatsapp', 'mercado_livre', 'email', 'telefone'));
  END IF;
END $$;

COMMENT ON COLUMN public.orcamentos.canal IS
  'Canal de venda: orcamento (proposta enviada) ou pedido direto por whatsapp, mercado_livre, email (OC) ou telefone.';

-- 3. Pedido direto -----------------------------------------------------------------
-- p_itens: [{ produto_id, codigo, descricao, variacao, unidade, quantidade, valor_unitario }]
CREATE OR REPLACE FUNCTION public.criar_pedido_direto(
  p_cliente_id uuid,
  p_canal text,
  p_itens jsonb,
  p_pedido_cliente text DEFAULT NULL,
  p_data_pedido date DEFAULT NULL,
  p_previsao_despacho date DEFAULT NULL,
  p_frete_valor numeric DEFAULT 0,
  p_observacoes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_cli record;
  v_pedido text := NULLIF(btrim(p_pedido_cliente), '');
  v_id uuid;
  v_numero text;
  v_itens int;
  v_qtd numeric;
  v_valor_itens numeric;
  v_frete numeric := GREATEST(COALESCE(p_frete_valor, 0), 0);
  v_res jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  IF p_canal IS NULL OR p_canal NOT IN ('whatsapp', 'mercado_livre', 'email', 'telefone') THEN
    RAISE EXCEPTION 'Canal inválido para pedido direto: %', COALESCE(p_canal, '(vazio)') USING ERRCODE = 'P0001';
  END IF;
  IF p_canal IN ('mercado_livre', 'email') AND v_pedido IS NULL THEN
    RAISE EXCEPTION '%', CASE p_canal WHEN 'mercado_livre' THEN 'Informe o número da venda do Mercado Livre'
                                      ELSE 'Informe o número da OC do cliente' END
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id, empresa_id, nome_razao_social, nome_fantasia, cpf_cnpj, inscricao_estadual, email, telefone,
         celular, contato, logradouro, numero, bairro, cidade, uf, cep, codigo_legado, ativo
    INTO v_cli
    FROM public.clientes
   WHERE id = p_cliente_id;
  IF NOT FOUND OR NOT COALESCE(v_cli.ativo, true) THEN
    RAISE EXCEPTION 'Cliente não encontrado ou inativo' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (v_cli.empresa_id IS NULL OR v_cli.empresa_id = public.current_empresa_id()
          OR public.has_role(v_user, 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão para este cliente' USING ERRCODE = '42501';
  END IF;

  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' THEN
    RAISE EXCEPTION 'Informe os itens do pedido' USING ERRCODE = 'P0001';
  END IF;
  SELECT count(*),
         sum((i->>'quantidade')::numeric),
         sum(round((i->>'quantidade')::numeric * COALESCE((i->>'valor_unitario')::numeric, 0), 2))
    INTO v_itens, v_qtd, v_valor_itens
    FROM jsonb_array_elements(p_itens) i
   WHERE COALESCE((i->>'quantidade')::numeric, 0) > 0;
  IF v_itens = 0 THEN
    RAISE EXCEPTION 'O pedido precisa de pelo menos um item com quantidade' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_itens) i
              WHERE COALESCE((i->>'quantidade')::numeric, 0) > 0
                AND NULLIF(i->>'produto_id', '') IS NULL
                AND NULLIF(btrim(i->>'descricao'), '') IS NULL) THEN
    RAISE EXCEPTION 'Todo item precisa de produto ou descrição' USING ERRCODE = 'P0001';
  END IF;

  v_numero := public.proximo_numero_orcamento();

  INSERT INTO public.orcamentos (
    numero, cliente_id, status, data_orcamento, observacoes, frete_valor,
    valor_total, quantidade_total, cliente_snapshot, canal, origem, vendedor_id
  ) VALUES (
    v_numero, v_cli.id, 'rascunho', COALESCE(p_data_pedido, CURRENT_DATE), p_observacoes, v_frete,
    v_valor_itens + v_frete, v_qtd,
    jsonb_build_object(
      'nome_razao_social', COALESCE(v_cli.nome_razao_social, ''), 'nome_fantasia', COALESCE(v_cli.nome_fantasia, ''),
      'cpf_cnpj', COALESCE(v_cli.cpf_cnpj, ''), 'inscricao_estadual', COALESCE(v_cli.inscricao_estadual, ''),
      'email', COALESCE(v_cli.email, ''), 'telefone', COALESCE(v_cli.telefone, ''), 'celular', COALESCE(v_cli.celular, ''),
      'contato', COALESCE(v_cli.contato, ''), 'logradouro', COALESCE(v_cli.logradouro, ''), 'numero', COALESCE(v_cli.numero, ''),
      'bairro', COALESCE(v_cli.bairro, ''), 'cidade', COALESCE(v_cli.cidade, ''), 'uf', COALESCE(v_cli.uf, ''),
      'cep', COALESCE(v_cli.cep, ''), 'codigo', COALESCE(v_cli.codigo_legado, '')),
    p_canal, 'sistema', NULL
  ) RETURNING id INTO v_id;

  INSERT INTO public.orcamentos_itens (
    orcamento_id, produto_id, codigo_snapshot, descricao_snapshot, variacao,
    quantidade, unidade, valor_unitario, valor_total
  )
  SELECT v_id,
         NULLIF(i->>'produto_id', '')::uuid,
         COALESCE(NULLIF(i->>'codigo', ''), p.codigo_interno, ''),
         COALESCE(NULLIF(btrim(i->>'descricao'), ''), p.nome, ''),
         COALESCE(i->>'variacao', ''),
         (i->>'quantidade')::numeric,
         COALESCE(NULLIF(i->>'unidade', ''), p.unidade_medida, 'UN'),
         COALESCE((i->>'valor_unitario')::numeric, 0),
         round((i->>'quantidade')::numeric * COALESCE((i->>'valor_unitario')::numeric, 0), 2)
    FROM jsonb_array_elements(p_itens) WITH ORDINALITY AS t(i, ord)
    LEFT JOIN public.produtos p ON p.id = NULLIF(i->>'produto_id', '')::uuid
   WHERE COALESCE((i->>'quantidade')::numeric, 0) > 0
   ORDER BY ord;

  -- Mesma regra do "Registrar pedido": vira Pedido, faturamento em aberto, auditoria.
  v_res := public.registrar_pedido_orcamento(v_id, v_pedido, p_data_pedido, p_previsao_despacho, NULL);

  RETURN v_res || jsonb_build_object('canal', p_canal);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.criar_pedido_direto(uuid, text, jsonb, text, date, date, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_pedido_direto(uuid, text, jsonb, text, date, date, numeric, text) TO authenticated;

-- 4. Mercado Livre: nº da venda liga a nota mesmo com destinatário diferente ------
CREATE OR REPLACE FUNCTION public.sugerir_pedidos_nf(p_nf_id uuid)
RETURNS TABLE (
  orcamento_id uuid,
  numero text,
  pedido_cliente text,
  status text,
  faturamento_status text,
  valor_total numeric,
  motivo text,
  referencia text,
  registrado boolean,
  vinculado boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH nf AS (
    SELECT n.id, n.cliente_id, n.valor_total, n.valor_produtos, n.empresa_id,
           public.raiz_documento(c.cpf_cnpj) AS raiz,
           COALESCE(n.referencias_pedido, ARRAY[]::text[]) AS refs
      FROM public.notas_fiscais n
      LEFT JOIN public.clientes c ON c.id = n.cliente_id
     WHERE n.id = p_nf_id
       AND (n.empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))
  ),
  refs AS (
    SELECT DISTINCT r AS original, public.normalizar_pedido(r) AS norm
      FROM nf, unnest(nf.refs) r
     WHERE public.normalizar_pedido(r) IS NOT NULL
  ),
  orc AS (
    SELECT o.*, public.raiz_documento(c.cpf_cnpj) AS raiz,
           (SELECT sum(oi.valor_total) FROM public.orcamentos_itens oi WHERE oi.orcamento_id = o.id) AS valor_itens
      FROM public.orcamentos o
      LEFT JOIN public.clientes c ON c.id = o.cliente_id
     WHERE COALESCE(o.ativo, true)
       AND o.status NOT IN ('cancelado', 'rejeitado', 'expirado')
  ),
  por_ref AS (
    SELECT o.id, 'xml_pedido'::text AS motivo, r.original AS referencia
      FROM orc o JOIN nf ON (nf.raiz = o.raiz OR (nf.raiz IS NULL AND nf.cliente_id = o.cliente_id)) JOIN refs r ON r.norm = public.normalizar_pedido(o.pedido_cliente)
     WHERE o.status IN ('aprovado', 'convertido')
    UNION
    -- Venda do Mercado Livre: o nº da venda é único; o destinatário da nota
    -- pode não bater com o comprador cadastrado.
    SELECT o.id, 'xml_pedido'::text, r.original
      FROM orc o CROSS JOIN nf JOIN refs r ON r.norm = public.normalizar_pedido(o.pedido_cliente)
     WHERE o.status IN ('aprovado', 'convertido')
       AND o.canal = 'mercado_livre'
       AND o.empresa_id IS NOT DISTINCT FROM nf.empresa_id
    UNION
    SELECT o.id, 'xml_orcamento', r.original
      FROM orc o JOIN nf ON (nf.raiz = o.raiz OR (nf.raiz IS NULL AND nf.cliente_id = o.cliente_id)) JOIN refs r ON r.norm = public.normalizar_pedido(o.numero)
  ),
  por_valor AS (
    SELECT o.id, 'valor'::text AS motivo, NULL::text AS referencia
      FROM orc o JOIN nf ON (nf.raiz = o.raiz OR (nf.raiz IS NULL AND nf.cliente_id = o.cliente_id))
     WHERE NOT EXISTS (SELECT 1 FROM por_ref)
       AND o.status IN ('aprovado', 'convertido')
       AND COALESCE(o.faturamento_status, 'aberto') IN ('aberto', 'parcial')
       AND (abs(o.valor_total - nf.valor_total) <= 0.01
            OR abs(o.valor_itens - nf.valor_total) <= 0.05
            OR abs(o.valor_itens - NULLIF(nf.valor_produtos, 0)) <= 0.05)
  ),
  cand AS (
    SELECT DISTINCT ON (id) id, motivo, referencia
      FROM (SELECT * FROM por_ref UNION ALL SELECT * FROM por_valor) x
     ORDER BY id, CASE motivo WHEN 'xml_pedido' THEN 1 WHEN 'xml_orcamento' THEN 2 ELSE 3 END
  )
  SELECT o.id, o.numero, o.pedido_cliente, o.status, o.faturamento_status, o.valor_total,
         c.motivo, c.referencia,
         o.status IN ('aprovado', 'convertido', 'historico') AS registrado,
         EXISTS (SELECT 1 FROM public.orcamento_nf_vinculos v WHERE v.orcamento_id = o.id AND v.nota_fiscal_id = p_nf_id) AS vinculado
    FROM cand c JOIN orc o ON o.id = c.id
   ORDER BY CASE c.motivo WHEN 'xml_pedido' THEN 1 WHEN 'xml_orcamento' THEN 2 ELSE 3 END, o.data_orcamento DESC
$$;
