-- ============================================================================
-- Pedidos pelo Orçamento — Etapa 2: vínculo nota fiscal ↔ pedido (orçamento)
-- ============================================================================
-- A NF de saída é emitida fora do ERP (Sebrae) e importada pelo XML. O XML
-- traz o número do pedido do cliente (xPed nos itens, "PEDIDO:"/"OC:" nas
-- informações complementares) ou o número do orçamento ("ORC100291"). Com
-- esse número a nota é ligada ao orçamento que é o pedido, item a item, e o
-- saldo a faturar (pedido − notas vinculadas) passa a existir por item.
--
-- Uma nota pode atender vários pedidos (COBB manda vários xPed) e um pedido
-- pode ter várias notas (entregas parciais). Nota cancelada deixa de contar.
-- ============================================================================

-- 1. Helpers ----------------------------------------------------------------
-- "1.181" = "01181" = "1181"; "orc100291" = "ORC100291".
CREATE OR REPLACE FUNCTION public.normalizar_pedido(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(upper(ltrim(regexp_replace(coalesce(p, ''), '[^0-9A-Za-z]', '', 'g'), '0')), '')
$$;

-- Raiz do CNPJ (8 dígitos) agrupa filiais; CPF fica inteiro.
CREATE OR REPLACE FUNCTION public.raiz_documento(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN length(regexp_replace(coalesce(p, ''), '\D', '', 'g')) = 14
      THEN left(regexp_replace(p, '\D', '', 'g'), 8)
    ELSE NULLIF(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '')
  END
$$;

-- 2. Referências lidas do XML -------------------------------------------------
ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS referencias_pedido text[];

COMMENT ON COLUMN public.notas_fiscais.referencias_pedido IS
  'Números de pedido/OC/orçamento lidos do XML (xPed dos itens e informações complementares).';

-- 3. Vínculos ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orcamento_nf_vinculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  nota_fiscal_id uuid NOT NULL REFERENCES public.notas_fiscais(id) ON DELETE CASCADE,
  origem text NOT NULL,
  referencia text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  CONSTRAINT uq_orcamento_nf_vinculo UNIQUE (orcamento_id, nota_fiscal_id),
  CONSTRAINT chk_orcamento_nf_vinculo_origem
    CHECK (origem IN ('xml_pedido', 'xml_orcamento', 'valor', 'manual', 'historico'))
);

CREATE INDEX IF NOT EXISTS idx_orcamento_nf_vinculos_nf ON public.orcamento_nf_vinculos (nota_fiscal_id);

COMMENT ON TABLE public.orcamento_nf_vinculos IS
  'NF de saída ligada ao orçamento que é o pedido. origem: xml_pedido | xml_orcamento | valor | manual | historico.';

CREATE TABLE IF NOT EXISTS public.orcamento_nf_vinculo_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vinculo_id uuid NOT NULL REFERENCES public.orcamento_nf_vinculos(id) ON DELETE CASCADE,
  orcamento_item_id uuid NOT NULL REFERENCES public.orcamentos_itens(id) ON DELETE CASCADE,
  nota_fiscal_item_id uuid NOT NULL REFERENCES public.notas_fiscais_itens(id) ON DELETE CASCADE,
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  CONSTRAINT uq_orcamento_nf_vinculo_item UNIQUE (orcamento_item_id, nota_fiscal_item_id)
);

CREATE INDEX IF NOT EXISTS idx_orcamento_nf_vinculo_itens_vinculo ON public.orcamento_nf_vinculo_itens (vinculo_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_nf_vinculo_itens_orc_item ON public.orcamento_nf_vinculo_itens (orcamento_item_id);

-- Leitura segue a visibilidade do orçamento; escrita só pelas RPCs abaixo.
ALTER TABLE public.orcamento_nf_vinculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_nf_vinculo_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orcamento_nf_vinculos_select ON public.orcamento_nf_vinculos;
CREATE POLICY orcamento_nf_vinculos_select ON public.orcamento_nf_vinculos
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orcamentos o
     WHERE o.id = orcamento_id
       AND (o.empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))
  ));

DROP POLICY IF EXISTS orcamento_nf_vinculo_itens_select ON public.orcamento_nf_vinculo_itens;
CREATE POLICY orcamento_nf_vinculo_itens_select ON public.orcamento_nf_vinculo_itens
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orcamento_nf_vinculos v
      JOIN public.orcamentos o ON o.id = v.orcamento_id
     WHERE v.id = vinculo_id
       AND (o.empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role))
  ));

GRANT SELECT ON public.orcamento_nf_vinculos, public.orcamento_nf_vinculo_itens TO authenticated;

-- 4. Saldo por item -----------------------------------------------------------
-- Nota cancelada ou inativa não conta.
CREATE OR REPLACE VIEW public.vw_orcamento_itens_saldo
WITH (security_invoker = on) AS
SELECT
  oi.id AS orcamento_item_id,
  oi.orcamento_id,
  oi.produto_id,
  oi.quantidade,
  COALESCE(f.faturado, 0) AS quantidade_faturada,
  GREATEST(COALESCE(oi.quantidade, 0) - COALESCE(f.faturado, 0), 0) AS saldo,
  COALESCE(f.faturado, 0) > COALESCE(oi.quantidade, 0) AS faturado_a_mais,
  COALESCE(f.notas, ARRAY[]::text[]) AS notas
FROM public.orcamentos_itens oi
LEFT JOIN LATERAL (
  SELECT sum(vi.quantidade) AS faturado,
         array_agg(DISTINCT nf.numero ORDER BY nf.numero) AS notas
    FROM public.orcamento_nf_vinculo_itens vi
    JOIN public.orcamento_nf_vinculos v ON v.id = vi.vinculo_id
    JOIN public.notas_fiscais nf ON nf.id = v.nota_fiscal_id
   WHERE vi.orcamento_item_id = oi.id
     AND nf.status <> 'cancelada'
     AND COALESCE(nf.ativo, true)
) f ON true;

GRANT SELECT ON public.vw_orcamento_itens_saldo TO authenticated;

-- 5. Situação de faturamento do pedido ----------------------------------------
CREATE OR REPLACE FUNCTION public.recalcular_faturamento_orcamento(p_orcamento_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_atual text;
  v_status text;
  v_itens int;
  v_itens_faturados int;
  v_itens_com_nota int;
  v_tem_nota boolean;
BEGIN
  SELECT faturamento_status INTO v_atual FROM public.orcamentos WHERE id = p_orcamento_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_atual = 'encerrado' THEN RETURN v_atual; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.orcamento_nf_vinculos v
      JOIN public.notas_fiscais nf ON nf.id = v.nota_fiscal_id
     WHERE v.orcamento_id = p_orcamento_id AND nf.status <> 'cancelada' AND COALESCE(nf.ativo, true)
  ) INTO v_tem_nota;

  SELECT count(*),
         count(*) FILTER (WHERE s.saldo = 0),
         count(*) FILTER (WHERE s.quantidade_faturada > 0)
    INTO v_itens, v_itens_faturados, v_itens_com_nota
    FROM public.vw_orcamento_itens_saldo s
   WHERE s.orcamento_id = p_orcamento_id;

  v_status := CASE
    WHEN NOT v_tem_nota THEN (CASE WHEN v_atual IS NULL THEN NULL ELSE 'aberto' END)
    -- Orçamento legado sem itens: a nota inteira fatura o pedido.
    WHEN v_itens = 0 THEN 'faturado'
    WHEN v_itens_faturados = v_itens THEN 'faturado'
    WHEN v_itens_com_nota > 0 THEN 'parcial'
    ELSE 'aberto'
  END;

  IF v_status IS DISTINCT FROM v_atual THEN
    UPDATE public.orcamentos SET faturamento_status = v_status, updated_at = now() WHERE id = p_orcamento_id;
  END IF;
  RETURN v_status;
END;
$$;

-- Nota cancelada/reativada: recalcula os pedidos ligados a ela.
CREATE OR REPLACE FUNCTION public.trg_nf_recalcula_pedidos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orc uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.ativo IS DISTINCT FROM OLD.ativo THEN
    FOR v_orc IN SELECT orcamento_id FROM public.orcamento_nf_vinculos WHERE nota_fiscal_id = NEW.id LOOP
      PERFORM public.recalcular_faturamento_orcamento(v_orc);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nf_recalcula_pedidos ON public.notas_fiscais;
CREATE TRIGGER trg_nf_recalcula_pedidos
  AFTER UPDATE OF status, ativo ON public.notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.trg_nf_recalcula_pedidos();

-- 6. Vincular / desvincular ---------------------------------------------------
-- Distribui os itens da nota entre os itens do pedido com o mesmo produto,
-- pelo saldo. O que passar do saldo fica no primeiro item (faturado a mais),
-- exceto quando a nota atende vários pedidos (o excedente não tem dono certo).
CREATE OR REPLACE FUNCTION public.vincular_nf_orcamento(
  p_nf_id uuid,
  p_orcamento_id uuid,
  p_origem text DEFAULT 'manual',
  p_referencia text DEFAULT NULL,
  p_permitir_excedente boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_nf record;
  v_orc record;
  v_vinculo uuid;
  v_nfi record;
  v_oi record;
  v_resto numeric;
  v_aloc numeric;
  v_primeiro uuid;
  v_itens_ligados int := 0;
  v_status text;
BEGIN
  SELECT id, numero, tipo, status, empresa_id, COALESCE(ativo, true) AS ativo
    INTO v_nf FROM public.notas_fiscais WHERE id = p_nf_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nota fiscal não encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF v_nf.tipo <> 'saida' THEN
    RAISE EXCEPTION 'Só notas de saída podem ser ligadas a um pedido' USING ERRCODE = 'P0001';
  END IF;
  IF v_nf.status = 'cancelada' OR NOT v_nf.ativo THEN
    RAISE EXCEPTION 'A NF % está cancelada e não pode ser ligada a um pedido', v_nf.numero USING ERRCODE = 'P0001';
  END IF;

  SELECT id, numero, status, empresa_id INTO v_orc FROM public.orcamentos WHERE id = p_orcamento_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (v_orc.empresa_id = public.current_empresa_id() OR public.has_role(v_user, 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão para alterar este orçamento' USING ERRCODE = '42501';
  END IF;
  IF v_orc.status NOT IN ('aprovado', 'convertido', 'historico') THEN
    RAISE EXCEPTION 'O orçamento % ainda não é um pedido (status: %). Registre o pedido antes.', v_orc.numero, v_orc.status
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (SELECT 1 FROM public.orcamento_nf_vinculos WHERE orcamento_id = p_orcamento_id AND nota_fiscal_id = p_nf_id) THEN
    RETURN jsonb_build_object('vinculo_id', NULL, 'orcamento', v_orc.numero, 'nf', v_nf.numero, 'ja_vinculado', true);
  END IF;

  INSERT INTO public.orcamento_nf_vinculos (orcamento_id, nota_fiscal_id, origem, referencia, created_by)
  VALUES (p_orcamento_id, p_nf_id, COALESCE(p_origem, 'manual'), NULLIF(btrim(p_referencia), ''), v_user)
  RETURNING id INTO v_vinculo;

  FOR v_nfi IN
    SELECT i.id, i.produto_id, i.quantidade
      FROM public.notas_fiscais_itens i
     WHERE i.nota_fiscal_id = p_nf_id AND i.produto_id IS NOT NULL AND COALESCE(i.quantidade, 0) > 0
     ORDER BY i.created_at, i.id
  LOOP
    -- Quanto deste item da nota ainda não foi para outro pedido.
    v_resto := v_nfi.quantidade - COALESCE((
      SELECT sum(x.quantidade) FROM public.orcamento_nf_vinculo_itens x WHERE x.nota_fiscal_item_id = v_nfi.id
    ), 0);
    v_primeiro := NULL;
    FOR v_oi IN
      SELECT s.orcamento_item_id, s.saldo
        FROM public.vw_orcamento_itens_saldo s
        JOIN public.orcamentos_itens oi ON oi.id = s.orcamento_item_id
       WHERE s.orcamento_id = p_orcamento_id AND s.produto_id = v_nfi.produto_id
       ORDER BY oi.created_at, oi.id
    LOOP
      v_primeiro := COALESCE(v_primeiro, v_oi.orcamento_item_id);
      EXIT WHEN v_resto <= 0;
      v_aloc := LEAST(v_resto, v_oi.saldo);
      IF v_aloc > 0 THEN
        INSERT INTO public.orcamento_nf_vinculo_itens (vinculo_id, orcamento_item_id, nota_fiscal_item_id, quantidade)
        VALUES (v_vinculo, v_oi.orcamento_item_id, v_nfi.id, v_aloc);
        v_resto := v_resto - v_aloc;
        v_itens_ligados := v_itens_ligados + 1;
      END IF;
    END LOOP;
    -- Sobrou quantidade (faturado a mais) e o pedido tem o produto: vai para o primeiro item.
    IF v_resto > 0 AND v_primeiro IS NOT NULL AND p_permitir_excedente THEN
      INSERT INTO public.orcamento_nf_vinculo_itens (vinculo_id, orcamento_item_id, nota_fiscal_item_id, quantidade)
      VALUES (v_vinculo, v_primeiro, v_nfi.id, v_resto)
      ON CONFLICT (orcamento_item_id, nota_fiscal_item_id)
        DO UPDATE SET quantidade = public.orcamento_nf_vinculo_itens.quantidade + EXCLUDED.quantidade;
      v_itens_ligados := v_itens_ligados + 1;
    END IF;
  END LOOP;

  v_status := public.recalcular_faturamento_orcamento(p_orcamento_id);

  INSERT INTO public.auditoria_logs (tabela, registro_id, acao, dados_novos, usuario_id)
  VALUES ('orcamentos', p_orcamento_id, 'vincular_nf',
          jsonb_build_object('nf', v_nf.numero, 'nota_fiscal_id', p_nf_id, 'origem', p_origem,
                             'referencia', p_referencia, 'itens_ligados', v_itens_ligados,
                             'faturamento_status', v_status),
          v_user);

  RETURN jsonb_build_object(
    'vinculo_id', v_vinculo, 'orcamento', v_orc.numero, 'nf', v_nf.numero,
    'itens_ligados', v_itens_ligados, 'faturamento_status', v_status, 'ja_vinculado', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.desvincular_nf_orcamento(p_nf_id uuid, p_orcamento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_orc record;
  v_status text;
BEGIN
  SELECT id, numero, empresa_id INTO v_orc FROM public.orcamentos WHERE id = p_orcamento_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (v_orc.empresa_id = public.current_empresa_id() OR public.has_role(v_user, 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão para alterar este orçamento' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.orcamento_nf_vinculos WHERE orcamento_id = p_orcamento_id AND nota_fiscal_id = p_nf_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esta nota não está ligada ao orçamento %', v_orc.numero USING ERRCODE = 'P0002';
  END IF;

  v_status := public.recalcular_faturamento_orcamento(p_orcamento_id);

  INSERT INTO public.auditoria_logs (tabela, registro_id, acao, dados_novos, usuario_id)
  VALUES ('orcamentos', p_orcamento_id, 'desvincular_nf',
          jsonb_build_object('nota_fiscal_id', p_nf_id, 'faturamento_status', v_status), v_user);

  RETURN jsonb_build_object('orcamento', v_orc.numero, 'faturamento_status', v_status);
END;
$$;

-- 7. Encerrar saldo (cliente desistiu do restante) ------------------------------
CREATE OR REPLACE FUNCTION public.encerrar_saldo_orcamento(p_id uuid, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_orc record;
BEGIN
  IF p_motivo IS NULL OR length(btrim(p_motivo)) < 5 THEN
    RAISE EXCEPTION 'Informe o motivo (mínimo 5 caracteres)' USING ERRCODE = '22023';
  END IF;
  SELECT id, numero, status, empresa_id, faturamento_status INTO v_orc FROM public.orcamentos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (v_orc.empresa_id = public.current_empresa_id() OR public.has_role(v_user, 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão para alterar este orçamento' USING ERRCODE = '42501';
  END IF;
  IF v_orc.status NOT IN ('aprovado', 'convertido') OR v_orc.faturamento_status NOT IN ('aberto', 'parcial') THEN
    RAISE EXCEPTION 'Só pedidos com saldo em aberto podem ser encerrados' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.orcamentos SET faturamento_status = 'encerrado', updated_at = now() WHERE id = p_id;

  INSERT INTO public.auditoria_logs (tabela, registro_id, acao, dados_anteriores, dados_novos, usuario_id)
  VALUES ('orcamentos', p_id, 'encerrar_saldo',
          jsonb_build_object('faturamento_status', v_orc.faturamento_status),
          jsonb_build_object('faturamento_status', 'encerrado', 'motivo', btrim(p_motivo)), v_user);

  RETURN jsonb_build_object('id', p_id, 'numero', v_orc.numero, 'faturamento_status', 'encerrado');
END;
$$;

-- 8. Encontrar o pedido da nota -------------------------------------------------
-- Candidatos do mesmo cliente (raiz do CNPJ):
--   xml_pedido    → pedido_cliente igual a uma referência do XML
--   xml_orcamento → número do orçamento igual a uma referência do XML
--   valor         → sem referência que bata: total ou produtos iguais ao da nota
-- `registrado` = false quando o orçamento citado ainda não virou pedido.
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

-- 9. Vínculo automático na importação do XML ------------------------------------
-- Grava as referências do XML e liga a nota a cada pedido que bate por número
-- (um por referência, sem ambiguidade). Valor sozinho só vira sugestão.
CREATE OR REPLACE FUNCTION public.vincular_nf_automatico(p_nf_id uuid, p_referencias text[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nf record;
  v_cand record;
  v_ref text;
  v_vinculados jsonb := '[]'::jsonb;
  v_pendentes jsonb := '[]'::jsonb;
  v_sugestoes jsonb := '[]'::jsonb;
  v_res jsonb;
  v_n int;
  v_total_pedidos int;
BEGIN
  SELECT id, numero, tipo, status, empresa_id INTO v_nf FROM public.notas_fiscais WHERE id = p_nf_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nota fiscal não encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (v_nf.empresa_id = public.current_empresa_id() OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão para esta nota' USING ERRCODE = '42501';
  END IF;
  IF v_nf.tipo <> 'saida' OR v_nf.status = 'cancelada' THEN
    RETURN jsonb_build_object('status', 'ignorada', 'vinculados', v_vinculados);
  END IF;

  IF p_referencias IS NOT NULL THEN
    UPDATE public.notas_fiscais
       SET referencias_pedido = (SELECT array_agg(DISTINCT btrim(r)) FROM unnest(p_referencias) r WHERE btrim(r) <> '')
     WHERE id = p_nf_id;
  END IF;

  SELECT count(DISTINCT s.orcamento_id) INTO v_total_pedidos
    FROM public.sugerir_pedidos_nf(p_nf_id) s
   WHERE s.motivo IN ('xml_pedido', 'xml_orcamento') AND s.registrado;

  -- Uma ligação por referência, só quando exatamente um orçamento bate.
  FOR v_ref IN
    SELECT DISTINCT s.referencia FROM public.sugerir_pedidos_nf(p_nf_id) s WHERE s.motivo IN ('xml_pedido', 'xml_orcamento')
  LOOP
    SELECT count(*) INTO v_n FROM public.sugerir_pedidos_nf(p_nf_id) s
     WHERE s.referencia = v_ref AND s.motivo IN ('xml_pedido', 'xml_orcamento');
    FOR v_cand IN
      SELECT * FROM public.sugerir_pedidos_nf(p_nf_id) s
       WHERE s.referencia = v_ref AND s.motivo IN ('xml_pedido', 'xml_orcamento')
    LOOP
      IF v_n = 1 AND v_cand.registrado THEN
        v_res := public.vincular_nf_orcamento(p_nf_id, v_cand.orcamento_id, v_cand.motivo, v_ref, v_total_pedidos <= 1);
        v_vinculados := v_vinculados || jsonb_build_object(
          'orcamento_id', v_cand.orcamento_id, 'numero', v_cand.numero,
          'pedido_cliente', v_cand.pedido_cliente, 'referencia', v_ref,
          'faturamento_status', v_res->>'faturamento_status');
      ELSIF v_n = 1 THEN
        v_pendentes := v_pendentes || jsonb_build_object(
          'orcamento_id', v_cand.orcamento_id, 'numero', v_cand.numero, 'referencia', v_ref, 'status', v_cand.status);
      ELSE
        v_sugestoes := v_sugestoes || jsonb_build_object(
          'orcamento_id', v_cand.orcamento_id, 'numero', v_cand.numero, 'referencia', v_ref, 'motivo', 'ambiguo');
      END IF;
    END LOOP;
  END LOOP;

  IF jsonb_array_length(v_vinculados) = 0 AND jsonb_array_length(v_pendentes) = 0 THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'orcamento_id', s.orcamento_id, 'numero', s.numero, 'pedido_cliente', s.pedido_cliente, 'motivo', s.motivo)), '[]'::jsonb)
      INTO v_sugestoes
      FROM public.sugerir_pedidos_nf(p_nf_id) s
     WHERE NOT s.vinculado;
  END IF;

  RETURN jsonb_build_object(
    'status', CASE
      WHEN jsonb_array_length(v_vinculados) > 0 THEN 'vinculado'
      WHEN jsonb_array_length(v_pendentes) > 0 THEN 'pedido_nao_registrado'
      WHEN jsonb_array_length(v_sugestoes) > 0 THEN 'sugestao'
      ELSE 'sem_pedido' END,
    'nf', v_nf.numero,
    'vinculados', v_vinculados,
    'pendentes', v_pendentes,
    'sugestoes', v_sugestoes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.normalizar_pedido(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.raiz_documento(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vincular_nf_orcamento(uuid, uuid, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.desvincular_nf_orcamento(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.encerrar_saldo_orcamento(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sugerir_pedidos_nf(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vincular_nf_automatico(uuid, text[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.recalcular_faturamento_orcamento(uuid) FROM PUBLIC, anon;

-- 10. Pedidos que já tinham OV faturada -----------------------------------------
-- Orçamentos convertidos em OV antes deste fluxo: o pedido do cliente vem da
-- OV e a NF que faturou a OV passa a ser vínculo do orçamento.
UPDATE public.orcamentos o
   SET pedido_cliente = COALESCE(o.pedido_cliente, NULLIF(btrim(ov.po_number), ''), o.numero),
       data_pedido_cliente = COALESCE(o.data_pedido_cliente, ov.data_po_cliente, ov.data_emissao),
       previsao_despacho = COALESCE(o.previsao_despacho, ov.data_prometida_despacho),
       pedido_registrado_em = COALESCE(o.pedido_registrado_em, ov.created_at),
       faturamento_status = COALESCE(o.faturamento_status, 'aberto')
  FROM public.ordens_venda ov
 WHERE ov.cotacao_id = o.id
   AND o.status = 'convertido'
   AND COALESCE(ov.ativo, true)
   AND ov.status <> 'cancelada';

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT o.id AS orcamento_id, nf.id AS nf_id, o.pedido_cliente
      FROM public.orcamentos o
      JOIN public.ordens_venda ov ON ov.cotacao_id = o.id
      JOIN public.notas_fiscais nf ON nf.ordem_venda_id = ov.id
     WHERE o.status = 'convertido'
       AND nf.tipo = 'saida' AND nf.status <> 'cancelada' AND COALESCE(nf.ativo, true)
       AND NOT EXISTS (SELECT 1 FROM public.orcamento_nf_vinculos v WHERE v.orcamento_id = o.id AND v.nota_fiscal_id = nf.id)
  LOOP
    -- Migração roda sem sessão (auth.uid() nulo): grava direto, sem a RPC.
    INSERT INTO public.orcamento_nf_vinculos (orcamento_id, nota_fiscal_id, origem, referencia)
    VALUES (r.orcamento_id, r.nf_id, 'historico', r.pedido_cliente);
    INSERT INTO public.orcamento_nf_vinculo_itens (vinculo_id, orcamento_item_id, nota_fiscal_item_id, quantidade)
    SELECT v.id, oi.id, ni.id, LEAST(ni.quantidade, oi.quantidade)
      FROM public.orcamento_nf_vinculos v
      JOIN public.notas_fiscais_itens ni ON ni.nota_fiscal_id = v.nota_fiscal_id
      JOIN LATERAL (
        SELECT oi2.id, oi2.quantidade FROM public.orcamentos_itens oi2
         WHERE oi2.orcamento_id = v.orcamento_id AND oi2.produto_id = ni.produto_id
         ORDER BY oi2.created_at, oi2.id LIMIT 1
      ) oi ON true
     WHERE v.orcamento_id = r.orcamento_id AND v.nota_fiscal_id = r.nf_id
       AND COALESCE(ni.quantidade, 0) > 0
    ON CONFLICT (orcamento_item_id, nota_fiscal_item_id) DO NOTHING;
    PERFORM public.recalcular_faturamento_orcamento(r.orcamento_id);
  END LOOP;
END $$;
