import { createContext, useContext, useMemo, type ReactNode } from "react";
import { bootstrapFiscal, type FiscalContainer } from "@/modules/fiscal";
import {
  FiscalDashboardService,
  SefazMonitorService,
  ObservabilidadeService,
  ProntidaoProducaoService,
  BuscaGlobalFiscalService,
} from "@/modules/fiscal/operacional";
import { bootstrapComplianceEngine, type ComplianceEngineContainer } from "@/modules/fiscal/compliance";

/**
 * Etapa 15 — Fiscal Runtime Provider.
 *
 * Integra o Framework Fiscal (Etapas 1–14) ao runtime do AVIZEE, expondo
 * um único container compartilhado por todas as telas de `/fiscal/*`.
 *
 * Objetivos:
 *  - Bootstrap único (singleton) do `FiscalContainer` + serviços operacionais + compliance;
 *  - Eliminar estados paralelos: qualquer página fiscal consome o runtime via `useFiscalRuntime()`;
 *  - Preservar Clean Architecture: nenhuma regra de negócio vive aqui, apenas composição.
 */
export interface FiscalRuntime {
  container: FiscalContainer;
  compliance: ComplianceEngineContainer;
  operacional: {
    dashboard: FiscalDashboardService;
    sefazMonitor: SefazMonitorService;
    observabilidade: ObservabilidadeService;
    prontidao: ProntidaoProducaoService;
    buscaGlobal: BuscaGlobalFiscalService;
  };
}

const FiscalRuntimeContext = createContext<FiscalRuntime | null>(null);

export function FiscalRuntimeProvider({ children }: { children: ReactNode }) {
  const runtime = useMemo<FiscalRuntime>(() => {
    const container = bootstrapFiscal();
    const compliance = bootstrapComplianceEngine();
    return {
      container,
      compliance,
      operacional: {
        dashboard: new FiscalDashboardService(),
        sefazMonitor: new SefazMonitorService(),
        observabilidade: new ObservabilidadeService(),
        prontidao: new ProntidaoProducaoService(),
        buscaGlobal: new BuscaGlobalFiscalService(),
      },
    };
  }, []);

  return (
    <FiscalRuntimeContext.Provider value={runtime}>{children}</FiscalRuntimeContext.Provider>
  );
}

export function useFiscalRuntime(): FiscalRuntime {
  const ctx = useContext(FiscalRuntimeContext);
  if (!ctx) {
    throw new Error("useFiscalRuntime deve ser usado dentro de <FiscalRuntimeProvider>");
  }
  return ctx;
}
