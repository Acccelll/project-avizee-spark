import { useMemo } from "react";
import type { DailyPoint, ProdRow, TopPoint } from "./types";

interface DrawerParams {
  dailyReceber: DailyPoint[];
  topClientes: TopPoint[];
  estoqueBaixo: ProdRow[];
  dailyVendas: DailyPoint[];
  topProdutos: TopPoint[];
}

export function useDashboardDrawerData(params: DrawerParams) {
  return useMemo(
    () => ({
      receber: {
        title: "Vencimentos dos Próximos 7 Dias",
        daily: params.dailyReceber,
        top: params.topClientes,
      },
      estoque: {
        title: "Estoque Crítico",
        daily: [] as DailyPoint[],
        top: params.estoqueBaixo.slice(0, 5).map((item) => ({
          nome: item.codigo_interno ? `${item.codigo_interno} – ${item.nome}` : item.nome,
          valor: item.estoque_atual ?? 0,
        })),
      },
      vendas: {
        title: "Vendas dos Últimos 7 Dias",
        daily: params.dailyVendas,
        top: params.topProdutos,
      },
    }),
    [params],
  );
}
