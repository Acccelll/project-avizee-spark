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
import { logger } from "@/lib/logger";
import { fetchAllPages } from "@/services/relatorios/lib/fetchAllPages";

/* -------- Estoque (KPIs do dashboard) -------- */

export interface DashboardEstoqueData {
  produtos: number;
  estoqueBaixo: ProdRow[];
  valorEstoque: number;
  minimosConfigurados: number;
}

export async function fetchDashboardEstoqueData(): Promise<DashboardEstoqueData> {
  try {
    const [produtosResult, minimoCountResult, valorResult] = await Promise.all([
      supabase.from("produtos").select("*", { count: "exact", head: true }).eq("ativo", true),
      supabase.from("produtos").select("id", { count: "exact", head: true }).eq("ativo", true).gt("estoque_minimo", 0),
      fetchAllPages(() => supabase.from("produtos")
        .select("estoque_atual, preco_custo").eq("ativo", true).order("id"), {
        onTruncated: () => { throw new Error("Valor de estoque excede limite seguro de consulta"); },
      }),
    ]);

    if (produtosResult.error) logger.error("[dashboard:estoque] produtos:", produtosResult.error.message);
    if (minimoCountResult.error) logger.error("[dashboard:estoque] estMinimo:", minimoCountResult.error.message);


    if (produtosResult.error || minimoCountResult.error) throw new Error("Falha ao carregar indicadores de estoque");

    const criticos: ProdRow[] = [];
    for (let from = 0; ; from += 500) {
      const { data, error } = await supabase.from("produtos")
        .select("id, nome, codigo_interno, estoque_atual, estoque_minimo, unidade_medida")
        .eq("ativo", true).gt("estoque_minimo", 0).order("id").range(from, from + 499);
      if (error) throw error;
      criticos.push(...filterEstoqueBaixo((data ?? []) as ProdRow[]));
      if ((data ?? []).length < 500) break;
    }
    return {
      produtos: produtosResult.count ?? 0,
      minimosConfigurados: minimoCountResult.count ?? 0,
      estoqueBaixo: criticos,
      valorEstoque: computeValorTotalEstoque(
        valorResult as Array<{ estoque_atual: number | null; preco_custo: number | null }>,
      ),
    };
  } catch (error) {
    logger.error("[dashboard:estoque] erro inesperado:", error);
    throw error;
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
      (() => {
        let q = supabase.from("pedidos_compra")
          .select("id", { count: "exact", head: true }).eq("ativo", true);
        if (dateFrom) q = q.gte("data_pedido", dateFrom);
        if (dateTo) q = q.lte("data_pedido", dateTo);
        return q;
      })(),
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

    for (const [name, result] of [
      ["clientes", clientesResult], ["fornecedores", fornecedoresResult],
      ["compras", comprasResult], ["aguardando", comprasAguardandoResult],
      ["atrasadas", comprasAtrasadasResult], ["remessas", remessasAtrasadasResult],
    ] as const) {
      if (result.error) throw new Error(`Dashboard auxiliar (${name}): ${result.error.message}`);
    }

    return {
      clientes: clientesResult.count ?? 0,
      fornecedores: fornecedoresResult.count ?? 0,
      compras: comprasResult.count ?? 0,
      comprasAguardando: (comprasAguardandoResult.data ?? []) as CompraAguardando[],
      comprasAtrasadasCount: comprasAtrasadasResult.count ?? 0,
      remessasAtrasadas: remessasAtrasadasResult.count ?? 0,
    };
  } catch (error) {
    logger.error("[dashboard:aux] erro inesperado:", error);
    throw error;
  }
}