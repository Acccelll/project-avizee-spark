import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CompraAguardando, DashboardDateRange } from "./types";

interface AuxData {
  clientes: number;
  fornecedores: number;
  compras: number;
  comprasAguardando: CompraAguardando[];
  remessasAtrasadas: number;
}

export function useDashboardAuxData(range: DashboardDateRange) {
  const loadAuxData = useCallback(async (): Promise<AuxData> => {
    const { dateFrom, dateTo } = range;
    const today = new Date().toISOString().slice(0, 10);

    const [
      { count: clientesCount },
      { count: fornecedoresCount },
      { count: comprasCount },
      { data: comprasAguardando },
      { count: remessasAtrasadasCount },
    ] = await Promise.all([
      supabase.from("clientes").select("*", { count: "exact", head: true }).eq("ativo", true),
      supabase.from("fornecedores").select("*", { count: "exact", head: true }).eq("ativo", true),
      supabase
        .from("pedidos_compra")
        .select("*", { count: "exact", head: true })
        .eq("ativo", true)
        .gte("data_pedido", dateFrom)
        .lte("data_pedido", dateTo),
      supabase
        .from("pedidos_compra")
        .select("id, numero, valor_total, data_pedido, data_entrega_prevista, fornecedores(nome_razao_social)")
        .eq("ativo", true)
        .in("status", ["aprovado", "enviado_ao_fornecedor", "aguardando_recebimento", "parcialmente_recebido"])
        .is("data_entrega_real", null)
        .order("data_entrega_prevista", { ascending: true })
        .limit(10),
      supabase
        .from("remessas")
        .select("id", { count: "exact", head: true })
        .lt("previsao_entrega", today)
        .not("status_transporte", "in", '("entregue","cancelado")'),
    ]);

    return {
      clientes: clientesCount ?? 0,
      fornecedores: fornecedoresCount ?? 0,
      compras: comprasCount ?? 0,
      comprasAguardando: (comprasAguardando ?? []) as CompraAguardando[],
      remessasAtrasadas: remessasAtrasadasCount ?? 0,
    };
  }, [range]);

  return { loadAuxData };
}
