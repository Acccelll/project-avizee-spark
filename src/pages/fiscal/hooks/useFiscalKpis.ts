import { useMemo } from "react";

export interface NotaFiscalKpiInput {
  status: string;
  valor_total: number | null;
}

export interface FiscalKpis {
  total: number;
  pendentes: number;
  confirmadas: number;
  valorTotal: number;
}

/**
 * Calcula KPIs fiscais sobre uma lista de NFs (geralmente já filtrada).
 * Extraído de `Fiscal.tsx` na Fase 3-final do roadmap fiscal.
 */
export function useFiscalKpis(notas: NotaFiscalKpiInput[]): FiscalKpis {
  return useMemo(() => {
    const total = notas.length;
    const pendentes = notas.filter((n) => n.status === "pendente").length;
    const confirmadas = notas.filter((n) =>
      ["confirmada", "autorizada", "importada"].includes(n.status),
    ).length;
    const valorTotal = notas.reduce(
      (s, n) => s + Number(n.valor_total || 0),
      0,
    );
    return { total, pendentes, confirmadas, valorTotal };
  }, [notas]);
}