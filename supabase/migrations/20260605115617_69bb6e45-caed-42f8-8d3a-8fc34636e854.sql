-- 1) Recria sidebar_alerts_kpis incluindo o contador notas_sem_forma_pagamento
DROP FUNCTION IF EXISTS public.sidebar_alerts_kpis();

CREATE OR REPLACE FUNCTION public.sidebar_alerts_kpis()
RETURNS TABLE(
  financeiro_vencidos integer,
  financeiro_vencer integer,
  estoque_baixo integer,
  orcamentos_pendentes integer,
  nf_rejeitadas integer,
  nfe_sem_manifestacao integer,
  pedidos_compra_pendentes integer,
  nfe_entrada_pendentes integer,
  notas_sem_forma_pagamento integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    (SELECT COUNT(*) FROM financeiro_lancamentos
       WHERE ativo = true
         AND status IN ('aberto','vencido')
         AND data_vencimento < CURRENT_DATE)::int,
    (SELECT COUNT(*) FROM financeiro_lancamentos
       WHERE ativo = true
         AND status = 'aberto'
         AND data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days')::int,
    (SELECT COUNT(*) FROM produtos
       WHERE COALESCE(ativo, true) = true
         AND COALESCE(estoque_minimo, 0) > 0
         AND COALESCE(estoque_atual, 0) <= COALESCE(estoque_minimo, 0))::int,
    (SELECT COUNT(*) FROM orcamentos
       WHERE ativo = true
         AND status IN ('pendente','aguardando_aprovacao','em_analise'))::int,
    (SELECT COUNT(*) FROM notas_fiscais
       WHERE ativo = true AND status = 'rejeitada')::int,
    (SELECT COUNT(*) FROM nfe_distribuicao
       WHERE status_manifestacao = 'sem_manifestacao')::int,
    (SELECT COUNT(*) FROM pedidos_compra
       WHERE ativo = true
         AND status IN ('rascunho','em_aprovacao','aguardando_aprovacao','pendente'))::int,
    (SELECT COUNT(*) FROM notas_fiscais
       WHERE ativo = true AND tipo = 'entrada' AND status = 'pendente')::int,
    (SELECT COUNT(*) FROM notas_fiscais
       WHERE ativo = true
         AND tipo = 'entrada'
         AND COALESCE(gera_financeiro, true) = true
         AND (forma_pagamento IS NULL OR forma_pagamento = '')
         AND COALESCE(origem,'') <> 'importacao_historica'
         AND status NOT IN ('cancelada','cancelada_sefaz','inativada'))::int;
$function$;

-- 2) Sincronização do status da fatura de cartão a partir dos lançamentos
CREATE OR REPLACE FUNCTION public.sync_fatura_status_from_lancamentos(p_fatura_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total     int := 0;
  v_pagos     int := 0;
  v_parciais  int := 0;
  v_novo_status text;
BEGIN
  SELECT
    count(*) FILTER (WHERE ativo = true AND COALESCE(origem_tipo,'') <> 'cartao_fatura'),
    count(*) FILTER (WHERE ativo = true AND COALESCE(origem_tipo,'') <> 'cartao_fatura' AND status = 'pago'),
    count(*) FILTER (WHERE ativo = true AND COALESCE(origem_tipo,'') <> 'cartao_fatura' AND status = 'parcial')
  INTO v_total, v_pagos, v_parciais
  FROM financeiro_lancamentos
  WHERE cartao_fatura_id = p_fatura_id;

  IF v_total = 0 THEN
    RETURN;
  END IF;

  v_novo_status :=
    CASE
      WHEN v_pagos = v_total THEN 'paga'
      WHEN v_pagos > 0 OR v_parciais > 0 THEN 'parcialmente_paga'
      ELSE 'em_aberto'
    END;

  UPDATE cartao_faturas
  SET status = v_novo_status, updated_at = now()
  WHERE id = p_fatura_id
    AND status <> v_novo_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_sync_fatura_status(p_fatura_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_fatura_status_from_lancamentos(p_fatura_id);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_sync_fatura_status(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_sync_fatura_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_fatura_status_from_lancamentos(uuid) TO authenticated, service_role;