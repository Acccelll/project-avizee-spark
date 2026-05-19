
-- ============================================================
-- Cobranças Recorrentes
-- ============================================================

CREATE TABLE IF NOT EXISTS public.financeiro_recorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  descricao text NOT NULL,
  valor numeric(14,2) NOT NULL,
  periodicidade text NOT NULL,
  dia_vencimento integer,
  data_inicio date NOT NULL,
  data_fim date,
  proxima_geracao date NOT NULL,
  qtd_ciclos_max integer,
  ciclos_gerados integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ativa',
  forma_pagamento text,
  cartao_id uuid REFERENCES public.cartoes_credito(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  conta_bancaria_id uuid REFERENCES public.contas_bancarias(id) ON DELETE SET NULL,
  conta_contabil_id uuid REFERENCES public.contas_contabeis(id) ON DELETE SET NULL,
  centro_custo_id uuid,
  observacoes text,
  motivo_encerramento text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  empresa_id uuid DEFAULT public.current_empresa_id(),
  CONSTRAINT chk_recorrencia_tipo CHECK (tipo IN ('receber','pagar')),
  CONSTRAINT chk_recorrencia_periodicidade CHECK (periodicidade IN ('mensal','bimestral','trimestral','semestral','anual')),
  CONSTRAINT chk_recorrencia_status CHECK (status IN ('ativa','pausada','encerrada','cancelada')),
  CONSTRAINT chk_recorrencia_dia_venc CHECK (dia_vencimento IS NULL OR (dia_vencimento BETWEEN 1 AND 31)),
  CONSTRAINT chk_recorrencia_valor CHECK (valor > 0),
  CONSTRAINT chk_recorrencia_parte CHECK (
    (tipo = 'receber' AND fornecedor_id IS NULL)
    OR (tipo = 'pagar' AND cliente_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_recorrencias_status_proxima
  ON public.financeiro_recorrencias (status, proxima_geracao)
  WHERE status = 'ativa';
CREATE INDEX IF NOT EXISTS idx_recorrencias_cartao ON public.financeiro_recorrencias (cartao_id);
CREATE INDEX IF NOT EXISTS idx_recorrencias_cliente ON public.financeiro_recorrencias (cliente_id);
CREATE INDEX IF NOT EXISTS idx_recorrencias_fornecedor ON public.financeiro_recorrencias (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_recorrencias_empresa ON public.financeiro_recorrencias (empresa_id);

DROP TRIGGER IF EXISTS trg_recorrencias_updated_at ON public.financeiro_recorrencias;
CREATE TRIGGER trg_recorrencias_updated_at
BEFORE UPDATE ON public.financeiro_recorrencias
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS recorrencia_id uuid REFERENCES public.financeiro_recorrencias(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recorrencia_ciclo integer;

CREATE UNIQUE INDEX IF NOT EXISTS uq_lanc_recorrencia_ciclo
  ON public.financeiro_lancamentos (recorrencia_id, recorrencia_ciclo)
  WHERE recorrencia_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lanc_recorrencia ON public.financeiro_lancamentos (recorrencia_id);

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE public.financeiro_recorrencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rec_select ON public.financeiro_recorrencias;
CREATE POLICY rec_select ON public.financeiro_recorrencias
  FOR SELECT TO authenticated
  USING (
    (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role))
    AND ((empresa_id = public.current_empresa_id()) OR public.has_role(auth.uid(), 'admin'::app_role))
  );

DROP POLICY IF EXISTS rec_insert ON public.financeiro_recorrencias;
CREATE POLICY rec_insert ON public.financeiro_recorrencias
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role))
    AND ((empresa_id = public.current_empresa_id()) OR public.has_role(auth.uid(), 'admin'::app_role))
  );

DROP POLICY IF EXISTS rec_update ON public.financeiro_recorrencias;
CREATE POLICY rec_update ON public.financeiro_recorrencias
  FOR UPDATE TO authenticated
  USING (
    (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role))
    AND ((empresa_id = public.current_empresa_id()) OR public.has_role(auth.uid(), 'admin'::app_role))
  )
  WITH CHECK (
    (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role))
  );

DROP POLICY IF EXISTS rec_delete ON public.financeiro_recorrencias;
CREATE POLICY rec_delete ON public.financeiro_recorrencias
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ── Helpers de data ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recorrencia_proxima_data(
  p_atual date,
  p_periodicidade text,
  p_dia_vencimento integer
) RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_meses integer;
  v_base date;
  v_eom date;
BEGIN
  v_meses := CASE p_periodicidade
    WHEN 'mensal' THEN 1
    WHEN 'bimestral' THEN 2
    WHEN 'trimestral' THEN 3
    WHEN 'semestral' THEN 6
    WHEN 'anual' THEN 12
    ELSE 1
  END;
  v_base := (p_atual + (v_meses || ' months')::interval)::date;
  IF p_dia_vencimento IS NULL THEN
    RETURN v_base;
  END IF;
  v_eom := (date_trunc('month', v_base) + interval '1 month - 1 day')::date;
  RETURN LEAST(
    (date_trunc('month', v_base) + ((p_dia_vencimento - 1) || ' days')::interval)::date,
    v_eom
  );
END;
$$;

-- ── Geração ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.gerar_lancamentos_recorrentes()
RETURNS TABLE(recorrencia_id uuid, lancamento_id uuid, ciclo integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_venc date;
  v_fatura_id uuid;
  v_fatura_venc date;
  v_lanc_id uuid;
  v_ciclo integer;
  v_proxima date;
BEGIN
  FOR r IN
    SELECT *
    FROM public.financeiro_recorrencias
    WHERE status = 'ativa'
      AND ativo = true
      AND proxima_geracao <= current_date
      AND (data_fim IS NULL OR proxima_geracao <= data_fim)
      AND (qtd_ciclos_max IS NULL OR ciclos_gerados < qtd_ciclos_max)
    ORDER BY proxima_geracao ASC
  LOOP
    v_venc := r.proxima_geracao;
    v_fatura_id := NULL;

    IF r.forma_pagamento = 'cartao_credito' AND r.cartao_id IS NOT NULL THEN
      BEGIN
        v_fatura_id := public.cartao_fatura_para_data(r.cartao_id, v_venc);
        IF v_fatura_id IS NOT NULL THEN
          SELECT data_vencimento INTO v_fatura_venc
            FROM public.cartao_faturas WHERE id = v_fatura_id;
          IF v_fatura_venc IS NOT NULL THEN
            v_venc := v_fatura_venc;
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_fatura_id := NULL;
      END;
    END IF;

    v_ciclo := r.ciclos_gerados + 1;

    INSERT INTO public.financeiro_lancamentos (
      tipo, descricao, valor, data_vencimento, status,
      forma_pagamento, cartao_id, cartao_fatura_id,
      cliente_id, fornecedor_id, conta_bancaria_id, conta_contabil_id,
      centro_custo_id, observacoes,
      recorrencia_id, recorrencia_ciclo,
      origem_tipo, origem_descricao, empresa_id
    ) VALUES (
      r.tipo, r.descricao, r.valor, v_venc, 'aberto',
      r.forma_pagamento, r.cartao_id, v_fatura_id,
      r.cliente_id, r.fornecedor_id, r.conta_bancaria_id, r.conta_contabil_id,
      r.centro_custo_id, r.observacoes,
      r.id, v_ciclo,
      'recorrencia', 'Gerado por recorrência', r.empresa_id
    )
    ON CONFLICT (recorrencia_id, recorrencia_ciclo) DO NOTHING
    RETURNING id INTO v_lanc_id;

    IF v_lanc_id IS NULL THEN
      SELECT id INTO v_lanc_id FROM public.financeiro_lancamentos
        WHERE financeiro_lancamentos.recorrencia_id = r.id
          AND financeiro_lancamentos.recorrencia_ciclo = v_ciclo
        LIMIT 1;
    END IF;

    v_proxima := public.recorrencia_proxima_data(r.proxima_geracao, r.periodicidade, r.dia_vencimento);

    UPDATE public.financeiro_recorrencias
       SET ciclos_gerados = v_ciclo,
           proxima_geracao = v_proxima,
           status = CASE
             WHEN qtd_ciclos_max IS NOT NULL AND v_ciclo >= qtd_ciclos_max THEN 'encerrada'
             WHEN data_fim IS NOT NULL AND v_proxima > data_fim THEN 'encerrada'
             ELSE status
           END,
           updated_at = now()
     WHERE id = r.id;

    recorrencia_id := r.id;
    lancamento_id := v_lanc_id;
    ciclo := v_ciclo;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.gerar_lancamentos_recorrentes() FROM public;
GRANT EXECUTE ON FUNCTION public.gerar_lancamentos_recorrentes() TO authenticated;

CREATE OR REPLACE FUNCTION public.gerar_lancamento_recorrencia_agora(p_recorrencia_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role)) THEN
    RAISE EXCEPTION 'sem permissao';
  END IF;

  UPDATE public.financeiro_recorrencias
     SET proxima_geracao = LEAST(proxima_geracao, current_date)
   WHERE id = p_recorrencia_id AND status = 'ativa';

  SELECT lancamento_id INTO v_id
    FROM public.gerar_lancamentos_recorrentes()
   WHERE recorrencia_id = p_recorrencia_id
   LIMIT 1;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.gerar_lancamento_recorrencia_agora(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.gerar_lancamento_recorrencia_agora(uuid) TO authenticated;
