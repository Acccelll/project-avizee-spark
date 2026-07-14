import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  useFiscalCentral: vi.fn(),
  useFiscalWorkspace: vi.fn(),
  gerarProntidao: vi.fn(),
}));

vi.mock("@/hooks/useFiscalCentral", () => ({
  useFiscalCentral: mocks.useFiscalCentral,
}));

vi.mock("@/hooks/useFiscalWorkspace", () => ({
  useFiscalWorkspace: mocks.useFiscalWorkspace,
}));

vi.mock("@/contexts/FiscalRuntimeContext", () => ({
  useFiscalRuntime: () => ({
    operacional: {
      prontidao: {
        gerar: mocks.gerarProntidao,
      },
    },
  }),
}));

import { FiscalRuntimeMiniWidget } from "../FiscalRuntimeMiniWidget";

function renderWidget() {
  return render(
    <MemoryRouter>
      <FiscalRuntimeMiniWidget />
    </MemoryRouter>,
  );
}

describe("FiscalRuntimeMiniWidget", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 14));
    mocks.useFiscalWorkspace.mockReturnValue({ period: "7d" });
    mocks.useFiscalCentral.mockReturnValue({
      query: { isLoading: false },
      taxaAutorizacao: 0.875,
    });
    mocks.gerarProntidao.mockReturnValue({ pendentes: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("consulta a central fiscal com o período do workspace", () => {
    renderWidget();

    expect(mocks.useFiscalCentral).toHaveBeenCalledWith({
      from: "2026-07-07",
      to: "2026-07-14",
    });
  });

  it("exibe taxa de autorização e link para a Central Fiscal", () => {
    renderWidget();

    expect(screen.getByText("87.5%")).toBeInTheDocument();
    expect(screen.getByText(/taxa de autorização/i)).toBeInTheDocument();
    expect(screen.getByText("Apto")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /abrir central fiscal/i })).toHaveAttribute(
      "href",
      "/fiscal/central",
    );
  });

  it("mostra skeleton enquanto a query carrega", () => {
    mocks.useFiscalCentral.mockReturnValue({
      query: { isLoading: true },
      taxaAutorizacao: 0,
    });

    renderWidget();

    expect(screen.queryByText(/taxa de autorização/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /abrir central fiscal/i })).toBeInTheDocument();
  });

  it("sinaliza pendências de prontidão", () => {
    mocks.gerarProntidao.mockReturnValue({ pendentes: ["logs", "permissoes"] });

    renderWidget();

    expect(screen.getByText("2 pendência(s)")).toBeInTheDocument();
  });
});