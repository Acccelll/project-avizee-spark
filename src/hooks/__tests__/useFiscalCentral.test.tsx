import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Mocks —————————————————————————————————————————————————————————————
const fetchMock = vi.fn();
vi.mock("@/services/fiscal/dashboardFiscal.service", () => ({
  fetchDashboardFiscal: (p: unknown) => fetchMock(p),
}));

const resumirMock = vi.fn((s: unknown) => ({ ok: true, s }));
const taxaMock = vi.fn(() => 0.9);
vi.mock("@/contexts/FiscalRuntimeContext", () => ({
  useFiscalRuntime: () => ({
    operacional: {
      dashboard: {
        resumir: (s: unknown) => resumirMock(s),
        taxaAutorizacao: (s: unknown) => taxaMock(s),
      },
    },
  }),
}));

import { useFiscalCentral } from "@/hooks/useFiscalCentral";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const KPIS = {
  saida: { autorizadas: 90, rejeitadas: 5, canceladas: 3, pendentes: 2 },
  entrada: { total: 40, semManifestacao: 4 },
};

describe("useFiscalCentral", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    resumirMock.mockClear();
    taxaMock.mockClear();
  });

  it("retorna defaults enquanto a query carrega", () => {
    fetchMock.mockReturnValue(new Promise(() => {})); // pending
    const { result } = renderHook(
      () => useFiscalCentral({ from: "2026-07-01", to: "2026-07-14" }),
      { wrapper },
    );
    expect(result.current.resumo).toBeNull();
    expect(result.current.taxaAutorizacao).toBe(0);
  });

  it("deriva resumo e taxa via runtime após a query resolver", async () => {
    fetchMock.mockResolvedValue(KPIS);
    const { result } = renderHook(
      () => useFiscalCentral({ from: "2026-07-01", to: "2026-07-14" }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));

    expect(fetchMock).toHaveBeenCalledWith({
      from: "2026-07-01",
      to: "2026-07-14",
    });
    expect(resumirMock).toHaveBeenCalledTimes(1);
    const arg = resumirMock.mock.calls[0][0] as {
      documentos: { emitidos: number; recebidos: number; autorizadas: number };
      distDFe: { pendentes: number };
      processamento: { pendentes: number };
    };
    // emitidos = autorizadas + rejeitadas + canceladas + pendentes = 100
    expect(arg.documentos.emitidos).toBe(100);
    expect(arg.documentos.recebidos).toBe(40);
    expect(arg.documentos.autorizadas).toBe(90);
    expect(arg.distDFe.pendentes).toBe(4);
    expect(arg.processamento.pendentes).toBe(2);

    expect(result.current.taxaAutorizacao).toBe(0.9);
    expect(result.current.resumo).toEqual({ ok: true, s: arg });
  });
});