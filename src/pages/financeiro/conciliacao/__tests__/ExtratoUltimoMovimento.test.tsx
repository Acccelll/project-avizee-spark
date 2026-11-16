import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ExtratoUltimoMovimento } from "../ExtratoUltimoMovimento";

const getUltimo = vi.fn();
vi.mock("@/services/financeiro/conciliacaoLoaders.service", () => ({
  getUltimoMovimentoExtrato: (id: string) => getUltimo(id),
}));

function renderComponent() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ExtratoUltimoMovimento contaId="conta-1" uploading={false} />
    </QueryClientProvider>,
  );
}

describe("ExtratoUltimoMovimento", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 16, 22, 30)); // 16/11/2026 22:30, horário local
    getUltimo.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("avisa quando nunca houve extrato", async () => {
    getUltimo.mockResolvedValue(null);
    renderComponent();
    expect(await screen.findByText(/Nenhum extrato importado/)).toBeInTheDocument();
  });

  it("mostra a data sem alerta quando o extrato é recente", async () => {
    getUltimo.mockResolvedValue("2026-11-10");
    renderComponent();
    const texto = await screen.findByText(/Último movimento importado/);
    expect(texto).toHaveTextContent("10/11/2026 (há 6 dias)");
    expect(texto).not.toHaveTextContent("importe o extrato");
  });

  it("destaca o atraso acima de 10 dias", async () => {
    getUltimo.mockResolvedValue("2026-09-30");
    renderComponent();
    const texto = await screen.findByText(/Último movimento importado/);
    expect(texto).toHaveTextContent("30/09/2026 (há 47 dias)");
    expect(texto).toHaveTextContent("importe o extrato");
  });
});
