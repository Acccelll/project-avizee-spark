import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFiscalRuntime } from "@/contexts/FiscalRuntimeContext";
import { fetchDashboardFiscal, type PeriodoFiscal } from "@/services/fiscal/dashboardFiscal.service";

/**
 * Etapa 15 — Hook reutilizável para a visão "Central Fiscal".
 *
 * Encapsula o padrão: buscar KPIs do ERP (`fetchDashboardFiscal`) e derivar o
 * resumo/taxa de autorização via `runtime.operacional.dashboard`. Qualquer
 * página/widget fiscal deve consumir este hook em vez de reimplementar a lógica.
 */
export function useFiscalCentral(periodo: PeriodoFiscal) {
  const runtime = useFiscalRuntime();

  const query = useQuery({
    queryKey: ["fiscal", "central", periodo.from, periodo.to],
    queryFn: () => fetchDashboardFiscal(periodo),
    staleTime: 60_000,
  });

  const resumo = useMemo(() => {
    const d = query.data;
    if (!d) return null;
    return runtime.operacional.dashboard.resumir({
      documentos: {
        emitidos:
          d.saida.autorizadas + d.saida.rejeitadas + d.saida.canceladas + d.saida.pendentes,
        recebidos: d.entrada.total,
        autorizadas: d.saida.autorizadas,
        rejeitadas: d.saida.rejeitadas,
        canceladas: d.saida.canceladas,
      },
      distDFe: { pendentes: d.entrada.semManifestacao },
      escrituracao: { inconsistencias: 0 },
      processamento: { pendentes: d.saida.pendentes },
    });
  }, [query.data, runtime]);

  const taxaAutorizacao = useMemo(() => {
    const d = query.data;
    if (!d) return 0;
    return runtime.operacional.dashboard.taxaAutorizacao({
      documentos: {
        emitidos: 0,
        recebidos: 0,
        autorizadas: d.saida.autorizadas,
        rejeitadas: d.saida.rejeitadas,
        canceladas: 0,
      },
      distDFe: { pendentes: 0 },
      escrituracao: { inconsistencias: 0 },
      processamento: { pendentes: 0 },
    });
  }, [query.data, runtime]);

  return { query, resumo, taxaAutorizacao, runtime };
}
