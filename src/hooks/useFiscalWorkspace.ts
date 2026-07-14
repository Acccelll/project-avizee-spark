import { useCallback, useEffect, useState } from "react";
import type { Period } from "@/components/filters/periodTypes";

/**
 * Etapa 15 — Workspace multi-contexto do módulo Fiscal.
 *
 * Persiste, no navegador, o contexto operacional (empresa ativa + período)
 * que as páginas de `/fiscal/*` devem compartilhar. Escopo intencionalmente
 * mínimo: apenas leitura/gravação local; nenhuma chamada a serviços fiscais.
 *
 * Serviços/queries continuam recebendo o período como parâmetro puro — este
 * hook apenas evita que cada tela reimplemente `useState` + storage.
 */
export interface FiscalWorkspaceState {
  empresaId: string | null;
  period: Period;
}

const STORAGE_KEY = "avizee.fiscal.workspace.v1";
const DEFAULT_STATE: FiscalWorkspaceState = { empresaId: null, period: "30d" };

function readStorage(): FiscalWorkspaceState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<FiscalWorkspaceState>;
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return DEFAULT_STATE;
  }
}

export function useFiscalWorkspace() {
  const [state, setState] = useState<FiscalWorkspaceState>(() => readStorage());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage indisponível — silencioso por design */
    }
  }, [state]);

  const setEmpresa = useCallback(
    (empresaId: string | null) => setState((s) => ({ ...s, empresaId })),
    [],
  );
  const setPeriod = useCallback(
    (period: Period) => setState((s) => ({ ...s, period })),
    [],
  );
  const reset = useCallback(() => setState(DEFAULT_STATE), []);

  return { ...state, setEmpresa, setPeriod, reset };
}