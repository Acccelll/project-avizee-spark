import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import FinanceiroPage from "@/pages/Financeiro";
import { renderWithSmokeProviders } from "./smokeTestUtils";

const mockUseSupabaseCrud = vi.fn();

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/useSupabaseCrud", () => ({
  useSupabaseCrud: (...args: unknown[]) => mockUseSupabaseCrud(...args),
}));

vi.mock("@/integrations/supabase/client", () => {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [] }),
  };

  return {
    supabase: {
      from: vi.fn(() => builder),
    },
  };
});

vi.mock("@/components/AdvancedFilterBar", () => ({
  AdvancedFilterBar: ({
    searchValue,
    onSearchChange,
    count,
    children,
  }: {
    searchValue: string;
    onSearchChange: (value: string) => void;
    count: number;
    children: React.ReactNode;
  }) => (
    <div>
      <input aria-label="search" value={searchValue} onChange={(e) => onSearchChange(e.target.value)} />
      <span>Count: {count}</span>
      {children}
    </div>
  ),
}));

vi.mock("@/components/DataTable", () => ({
  DataTable: ({ columns, data }: { columns: any[]; data: any[] }) => (
    <div>
      <div>Rows: {data.length}</div>
      {data.map((row) => (
        <div key={row.id}>
          <span>{row.descricao}</span>
          {columns.find((c) => c.key === "acoes_rapidas")?.render(row)}
        </div>
      ))}
    </div>
  ),
}));

vi.mock("@/components/financeiro/BaixaParcialDialog", () => ({
  BaixaParcialDialog: ({ open }: { open: boolean }) => (open ? <div>BaixaParcialAberta</div> : null),
}));

vi.mock("@/components/financeiro/BaixaLoteModal", () => ({
  BaixaLoteModal: () => null,
}));

vi.mock("@/components/financeiro/FinanceiroDrawer", () => ({
  FinanceiroDrawer: () => null,
}));

vi.mock("@/components/financeiro/FinanceiroCalendar", () => ({
  FinanceiroCalendar: () => <div>CalendarioMock</div>,
}));

describe("smoke: financeiro abertura, filtros e baixa mínima", () => {
  beforeEach(() => {
    mockUseSupabaseCrud.mockReset();

    const lancamentos = {
      data: [
        {
          id: "l1",
          tipo: "receber",
          descricao: "Receita Projeto A",
          valor: 100,
          data_vencimento: "2026-04-20",
          status: "aberto",
          saldo_restante: null,
          clientes: { nome_razao_social: "Cliente A" },
          fornecedores: null,
          contas_bancarias: null,
          parcela_numero: 0,
          parcela_total: 0,
        },
        {
          id: "l2",
          tipo: "pagar",
          descricao: "Despesa Operacional",
          valor: 80,
          data_vencimento: "2026-04-21",
          status: "aberto",
          saldo_restante: null,
          clientes: null,
          fornecedores: { nome_razao_social: "Fornecedor B" },
          contas_bancarias: null,
          parcela_numero: 0,
          parcela_total: 0,
        },
      ],
      loading: false,
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      fetchData: vi.fn(),
    };

    mockUseSupabaseCrud
      .mockReturnValueOnce(lancamentos)
      .mockReturnValueOnce({ data: [], loading: false })
      .mockReturnValueOnce({ data: [], loading: false });
  });

  it("abre financeiro, aplica busca principal e permite iniciar baixa", async () => {
    renderWithSmokeProviders(<FinanceiroPage />, "/financeiro");

    expect(await screen.findByText("Contas a Pagar/Receber")).toBeInTheDocument();
    expect(await screen.findByText("Rows: 2")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("search"), { target: { value: "Projeto" } });
    expect(await screen.findByText("Count: 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Baixar lançamento: Receita Projeto A/i }));
    expect(await screen.findByText("BaixaParcialAberta")).toBeInTheDocument();
  });
});
