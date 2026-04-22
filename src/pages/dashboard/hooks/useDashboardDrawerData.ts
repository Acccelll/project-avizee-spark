import { useMemo } from "react";
import type { DailyPoint, ProdRow, TopPoint } from "./types";

interface DrawerParams {
  dailyReceber: DailyPoint[];
  dailyPagar: DailyPoint[];
  topClientes: TopPoint[];
  estoqueBaixo: ProdRow[];
  dailyVendas: DailyPoint[];
  topProdutos: TopPoint[];
}

export function useDashboardDrawerData(params: DrawerParams) {
  const { dailyReceber, dailyPagar, topClientes, estoqueBaixo, dailyVendas, topProdutos } = params;

  return useMemo(
    () => ({
      receber: {
        title: "Vencimentos dos Próximos 7 Dias",
        daily: dailyReceber,
        top: topClientes,
      },
      pagar: {
        title: "Pagamentos dos Próximos 7 Dias",
        daily: dailyPagar,
        top: [] as TopPoint[],
      },
      saldo: {
        title: "Saldo Diário Projetado (próximos 7 dias)",
        daily: dailyReceber.map((r, i) => ({
          dia: r.dia,
          valor: r.valor - (dailyPagar[i]?.valor ?? 0),
        })),
        top: [] as TopPoint[],
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
    [dailyReceber, dailyPagar, topClientes, estoqueBaixo, dailyVendas, topProdutos],
  );
}
