import { supabase } from "@/integrations/supabase/client";
import {
  computeValorTotalEstoque,
  filterEstoqueBaixo,
} from "@/lib/dashboard/aggregations";
import type {
  CompraAguardando,
  DashboardDateRange,
  ProdRow,
} from "@/pages/dashboard/hooks/types";

/* -------- Estoque (KPIs do dashboard) -------- */

export interface DashboardEstoqueData {
  produtos: number;
  estoqueBaixo: ProdRow[];
  valorEstoque: number;
}

export async function fetchDashboardEstoqueData(): Promise<DashboardEstoqueData> {
  try {
    const [produtosResult, estMinResult, valorResult] = await Promise.all([
      supabase.from("produtos").select("*", { count: "exact", head: true }).eq("ativo", true),
      supabase
        .from("produtos")
        .select("id, nome, codigo_interno, estoque_atual, estoque_minimo, unidade_medida")
        .eq("ativo", true)
        .not("estoque_minimo", "is", null)
        .limit(100),
      supabase.from("produtos").select("estoque_atual, preco_custo").eq("ativo", true),
    ]);

    if (produtosResult.error) console.error("[dashboard:estoque] produtos:", produtosResult.error.message);
    if (estMinResult.error) console.error("[dashboard:estoque] estMinimo:", estMinResult.error.message);
    if (valorResult.error) console.error("[dashboard:estoque] valor:", valorResult.error.message);

    return {
      produtos: produtosResult.count ?? 0,
      estoqueBaixo: filterEstoqueBaixo((estMinResult.data ?? []) as ProdRow[]),
      valorEstoque: computeValorTotalEstoque(
        (valorResult.data ?? []) as Array<{ estoque_atual: number | null; preco_custo: number | null }>,
      ),
    };
  } catch (error) {
    console.error("[dashboard:estoque] erro inesperado:", error);
    return { produtos: 0, estoqueBaixo: [], valorEstoque: 0 };
  }
}

/* -------- Aux (clientes / fornecedores / compras / remessas) -------- */

export interface DashboardAuxData {
  clientes: number;
  fornecedores: number;
  compras: number;
  comprasAguardando: CompraAguardando[];
  comprasAtrasadasCount: number;
  remessasAtrasadas: number;
}

function todayLocalIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function fetchDashboardAuxData(range: DashboardDateRange): Promise<DashboardAuxData> {
  const { dateFrom, dateTo } = range;
  const today = todayLocalIso();

  try {
    const [
      clientesResult,
      fornecedoresResult,
      comprasResult,
      comprasAguardandoResult,
      comprasAtrasadasResult,
      remessasAtrasadasResult,
    ] = await Promise.all([
      supabase.from("clientes").select("*", { count: "exact", head: true }).eq("ativo", true),
      supabase.from("fornecedores").select("*", { count: "exact", head: true }).eq("ativo", true),
      supabase
        .from("pedidos_compra")
        .select("*", { count: "exact", head: true })
        .eq("ativo", true)
        .gte("data_pedido", dateFrom ?? "")
        .lte("data_pedido", dateTo ?? ""),
      supabase
        .from("pedidos_compra")
        .select("id, numero, valor_total, data_pedido, data_entrega_prevista, fornecedores(nome_razao_social)")
        .eq("ativo", true)
        .in("status", ["aprovado", "enviado_ao_fornecedor", "aguardando_recebimento", "parcialmente_recebido"])
        .is("data_entrega_real", null)
        .order("data_entrega_prevista", { ascending: true })
        .limit(10),
      supabase
        .from("pedidos_compra")
        .select("*", { count: "exact", head: true })
        .eq("ativo", true)
        .in("status", ["aprovado", "enviado_ao_fornecedor", "aguardando_recebimento", "parcialmente_recebido"])
        .is("data_entrega_real", null)
        .lt("data_entrega_prevista", today),
      supabase
        .from("remessas")
        .select("id", { count: "exact", head: true })
        .lt("previsao_entrega", today)
        .not("status_transporte", "in", '("entregue","cancelado","devolvido")'),
    ]);

    if (clientesResult.error) console.error("[dashboard:aux] clientes:", clientesResult.error.message);
    if (remessasAtrasadasResult.error) console.error("[dashboard:aux] remessas:", remessasAtrasadasResult.error.message);

    return {
      clientes: clientesResult.count ?? 0,
      fornecedores: fornecedoresResult.count ?? 0,
      compras: comprasResult.count ?? 0,
      comprasAguardando: (comprasAguardandoResult.data ?? []) as CompraAguardando[],
      comprasAtrasadasCount: comprasAtrasadasResult.count ?? 0,
      remessasAtrasadas: remessasAtrasadasResult.count ?? 0,
    };
  } catch (error) {
    console.error("[dashboard:aux] erro inesperado:", error);
    return {
      clientes: 0,
      fornecedores: 0,
      compras: 0,
      comprasAguardando: [],
      comprasAtrasadasCount: 0,
      remessasAtrasadas: 0,
    };
  }
}