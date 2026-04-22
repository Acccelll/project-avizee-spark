import { useMemo } from "react";
import type { Lancamento } from "@/types/domain";

interface Params {
  filteredData: Lancamento[];
  getLancamentoStatus: (l: Lancamento) => string;
  hojeStr: string;
}

export function useFinanceiroKpis({ filteredData, getLancamentoStatus, hojeStr }: Params) {
  return useMemo(() => {
    let aVencer = 0;
    let venceHoje = 0;
    let vencido = 0;
    let pagoNoPeriodo = 0;
    let parcialCount = 0;
    let totalAVencer = 0;
    let totalVencido = 0;
    let totalPago = 0;
    let totalParcial = 0;

    filteredData.forEach((item) => {
      const valor = Number(item.valor || 0);
      const effectiveStatus = getLancamentoStatus(item);

      if (effectiveStatus === "pago") {
        pagoNoPeriodo++;
        totalPago += valor;
      } else if (effectiveStatus === "vencido") {
        vencido++;
        totalVencido += valor;
      } else if (effectiveStatus === "parcial") {
        parcialCount++;
        // Padronizado: KPI usa valor original do título (consistente com os demais cards).
        // Saldo em aberto continua disponível em `item.saldo_restante` para uso pontual.
        totalParcial += valor;
      } else if (effectiveStatus === "aberto") {
        if (item.data_vencimento === hojeStr) venceHoje++;
        aVencer++;
        totalAVencer += valor;
      }
    });

    return {
      aVencer,
      venceHoje,
      vencido,
      pagoNoPeriodo,
      parcialCount,
      totalAVencer,
      totalVencido,
      totalPago,
      totalParcial,
    };
  }, [filteredData, getLancamentoStatus, hojeStr]);
}
