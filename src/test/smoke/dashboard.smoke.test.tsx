import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import DashboardPage from "@/pages/Index";
import { makeAuthState, renderWithSmokeProviders } from "./smokeTestUtils";

const mockUseAuth = vi.fn();
const mockUseDashboardData = vi.fn();
const mockLoadData = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/hooks/useMetas", () => ({
  useMetas: () => ({ metas: { receber: 100, pagar: 100, saldo: 0 } }),
}));

vi.mock("@/pages/dashboard/hooks/useDashboardData", () => ({
  useDashboardData: () => mockUseDashboardData(),
}));

vi.mock("@/components/dashboard/VendasChart", () => ({
  VendasChart: () => <div>VendasChartMock</div>,
}));

describe("smoke: dashboard cenário feliz", () => {
  beforeEach(() => {
    mockLoadData.mockReset();
    mockUseAuth.mockReturnValue(makeAuthState());
    mockUseDashboardData.mockReturnValue({
      stats: { produtos: 10, orcamentos: 2, contasReceber: 3, contasPagar: 2, contasVencidas: 1, totalReceber: 1200, totalPagar: 400 },
      loading: false,
      loadedAt: new Date("2026-04-15T10:00:00Z"),
      loadData: mockLoadData,
      backlogOVs: [],
      comprasAguardando: [],
      dailyPagar: [{ dia: "15/04", valor: 100 }],
      dailyReceber: [{ dia: "15/04", valor: 300 }],
      dailyVendas: [{ dia: "15/04", valor: 500 }],
      estoqueBaixo: [],
      fiscalStats: { emitidas: 2, pendentes: 0, canceladas: 0, valorEmitidas: 500 },
      recentOrcamentos: [],
      remessasAtrasadas: 0,
      ticketMedio: 250,
      topClientes: [],
      topProdutos: [],
      valorEstoque: 2000,
      vencimentosHoje: { receber: 1, pagar: 0 },
    });
  });

  it("renderiza dashboard principal com cards e blocos críticos", async () => {
    renderWithSmokeProviders(<DashboardPage />);

    expect(await screen.findByText(/Contas a Receber/i)).toBeInTheDocument();
    expect(await screen.findByText(/Contas a Pagar/i)).toBeInTheDocument();
    expect(await screen.findByText(/Saldo Projetado/i)).toBeInTheDocument();
    expect(await screen.findByText(/Pendências/i)).toBeInTheDocument();
    expect(await screen.findByText("VendasChartMock")).toBeInTheDocument();
    expect(mockLoadData).toHaveBeenCalled();
  });
});
