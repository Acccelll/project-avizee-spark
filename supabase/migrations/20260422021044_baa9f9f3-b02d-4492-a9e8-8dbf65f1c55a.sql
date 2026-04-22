-- 1) Novas colunas para suportar revisões
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS numero_base text,
  ADD COLUMN IF NOT EXISTS revisao integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS orcamento_pai_id uuid REFERENCES public.orcamentos(id) ON DELETE SET NULL;

-- 2) Índices
CREATE UNIQUE INDEX IF NOT EXISTS uq_orcamentos_numero ON public.orcamentos(numero);
CREATE INDEX IF NOT EXISTS idx_orcamentos_numero_base ON public.orcamentos(numero_base);
CREATE INDEX IF NOT EXISTS idx_orcamentos_pai ON public.orcamentos(orcamento_pai_id);

-- 3) Backfill: renomear COT* → ORC* (apenas o(s) registro(s) com prefixo COT)
UPDATE public.orcamentos
   SET numero = 'ORC' || substring(numero from 4)
 WHERE numero LIKE 'COT%';

-- 4) Backfill: popular numero_base e revisao para registros não-históricos
UPDATE public.orcamentos
   SET numero_base = numero,
       revisao = COALESCE(revisao, 0)
 WHERE numero_base IS NULL
   AND COALESCE(origem, '') <> 'importacao_historica';

-- 5) Garantir que a sequence avance para evitar colisão futura
DO $$
DECLARE
  v_max bigint;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(numero, '^ORC', ''), '')::bigint), 0)
    INTO v_max
    FROM public.orcamentos
   WHERE numero ~ '^ORC[0-9]+$';
  IF v_max > 0 THEN
    PERFORM setval('public.seq_orcamento', GREATEST(v_max, currval('public.seq_orcamento')));
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- se currval falhar (sequence não foi tocada nesta sessão), define direto
  IF v_max > 0 THEN
    PERFORM setval('public.seq_orcamento', v_max);
  END IF;
END$$;

-- 6) Substituir função de numeração: COT → ORC
CREATE OR REPLACE FUNCTION public.proximo_numero_orcamento()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 'ORC' || LPAD(nextval('public.seq_orcamento')::text, 6, '0')
$function$;

-- 7) Nova RPC: criar revisão de um orçamento existente
CREATE OR REPLACE FUNCTION public.criar_revisao_orcamento(p_orcamento_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_orig record;
  v_base text;
  v_root_id uuid;
  v_next_rev integer;
  v_new_id uuid;
  v_new_numero text;
BEGIN
  SELECT * INTO v_orig FROM public.orcamentos WHERE id = p_orcamento_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento % não encontrado', p_orcamento_id;
  END IF;

  -- Determinar a base (numero original sem sufixo de revisão)
  v_base := COALESCE(v_orig.numero_base, split_part(v_orig.numero, '.', 1));
  v_root_id := COALESCE(v_orig.orcamento_pai_id, v_orig.id);

  -- Próxima revisão: max(revisao)+1 entre todos os registros da mesma base
  SELECT COALESCE(MAX(revisao), 0) + 1
    INTO v_next_rev
    FROM public.orcamentos
   WHERE numero_base = v_base;

  v_new_numero := v_base || '.' || v_next_rev::text;

  -- Clonar cabeçalho
  INSERT INTO public.orcamentos (
    numero, data_orcamento, status, cliente_id, validade,
    observacoes, observacoes_internas,
    desconto, imposto_st, imposto_ipi, frete_valor, outras_despesas,
    valor_total, quantidade_total, peso_total,
    pagamento, prazo_pagamento, prazo_entrega,
    frete_tipo, modalidade, cliente_snapshot,
    transportadora_id, frete_simulacao_id, origem_frete, servico_frete,
    prazo_entrega_dias, volumes, altura_cm, largura_cm, comprimento_cm,
    numero_base, revisao, orcamento_pai_id
  )
  VALUES (
    v_new_numero, CURRENT_DATE, 'rascunho', v_orig.cliente_id, NULL,
    v_orig.observacoes, v_orig.observacoes_internas,
    v_orig.desconto, v_orig.imposto_st, v_orig.imposto_ipi, v_orig.frete_valor, v_orig.outras_despesas,
    v_orig.valor_total, v_orig.quantidade_total, v_orig.peso_total,
    v_orig.pagamento, v_orig.prazo_pagamento, v_orig.prazo_entrega,
    v_orig.frete_tipo, v_orig.modalidade, v_orig.cliente_snapshot,
    v_orig.transportadora_id, v_orig.frete_simulacao_id, v_orig.origem_frete, v_orig.servico_frete,
    v_orig.prazo_entrega_dias, v_orig.volumes, v_orig.altura_cm, v_orig.largura_cm, v_orig.comprimento_cm,
    v_base, v_next_rev, v_root_id
  )
  RETURNING id INTO v_new_id;

  -- Clonar itens
  INSERT INTO public.orcamentos_itens (
    orcamento_id, produto_id, codigo_snapshot, descricao_snapshot,
    variacao, quantidade, unidade, valor_unitario, valor_total,
    peso_unitario, peso_total
  )
  SELECT
    v_new_id, produto_id, codigo_snapshot, descricao_snapshot,
    variacao, quantidade, unidade, valor_unitario, valor_total,
    peso_unitario, peso_total
  FROM public.orcamentos_itens
  WHERE orcamento_id = p_orcamento_id;

  RETURN v_new_id;
END;
$$;