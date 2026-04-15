import { useMemo } from "react";
import type { DailyPoint, ProdRow, TopPoint } from "./types";

interface DrawerParams {
  dailyReceber: DailyPoint[];
  topClientes: TopPoint[];
  estoqueBaixo: ProdRow[];
  dailyVendas: DailyPoint[];
  topProdutos: TopPoint[];
}

export function useDashboardDrawerData({
  dailyReceber,
  topClientes,
  estoqueBaixo,
  dailyVendas,
  topProdutos,
}: DrawerParams) {
  return useMemo(
    () => ({
      receber: {
        title: "Vencimentos dos Próximos 7 Dias",
        daily: dailyReceber,
        top: topClientes,
      },
      estoque: {
        title: "Estoque Crítico",
        daily: [] as DailyPoint[],
        top: estoqueBaixo.slice(0, 5).map((item) => ({
          nome: item.codigo_interno ? `${item.codigo_interno} – ${item.nome}` : item.nome,
          valor: item.estoque_atual ?? 0,
        })),
      },
      vendas: {
        title: "Vendas dos Últimos 7 Dias",
        daily: dailyVendas,
        top: topProdutos,
      },
    }),
    [dailyReceber, topClientes, estoqueBaixo, dailyVendas, topProdutos],
  );
}
