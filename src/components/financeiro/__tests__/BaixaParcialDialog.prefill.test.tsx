import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BaixaParcialDialog } from "../BaixaParcialDialog";

const sugerir = vi.fn();
vi.mock("@/services/financeiro", () => ({
  fetchBaixasAtivasDoLancamento: vi.fn().mockResolvedValue([]),
  sugerirContaBancariaBaixa: (p: unknown) => sugerir(p),
}));
vi.mock("@/pages/financeiro/hooks/useBaixaFinanceira", () => ({
  useRegistrarBaixa: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/useCanEditFinanceiroAvancado", () => ({
  useCanEditFinanceiroAvancado: () => ({ canEditAvancado: false }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const contas = [
  { id: "c1", descricao: "Conta Movimento", bancos: { nome: "Banco A" } },
  { id: "c2", descricao: "Conta Reserva", bancos: { nome: "Banco B" } },
];

const titulo = {
  id: "t1",
  descricao: "Fornecedor X — NF 123",
  valor: 500,
  saldo_restante: 500,
  status: "aberto",
  data_vencimento: "2026-11-10",
  forma_pagamento: "boleto",
  conta_bancaria_id: null,
  fornecedor_id: "f1",
  cliente_id: null,
};

function renderDialog(lancamento = titulo) {
  return render(
    <BaixaParcialDialog
      open
      onClose={() => {}}
      lancamento={lancamento}
      contasBancarias={contas}
      onSuccess={() => {}}
    />,
  );
}

describe("BaixaParcialDialog — pré-preenchimento", () => {
  beforeEach(() => sugerir.mockReset());

  it("abre com a forma do título e a conta da última baixa da pessoa", async () => {
    sugerir.mockResolvedValue("c2");
    renderDialog();

    expect(await screen.findByText("Boleto/DDA")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Banco B - Conta Reserva")).toBeInTheDocument());
    expect(sugerir).toHaveBeenCalledWith({ fornecedorId: "f1", clienteId: null, formaPagamento: "boleto_dda" });
    expect(screen.getByText(/conta da última baixa desta pessoa/i)).toBeInTheDocument();
  });

  it("usa a conta do próprio título quando ela existe, sem consultar o histórico", async () => {
    renderDialog({ ...titulo, conta_bancaria_id: "c1" });
    expect(await screen.findByText("Banco A - Conta Movimento")).toBeInTheDocument();
    expect(sugerir).not.toHaveBeenCalled();
  });

  it("ignora sugestão de conta que não está na lista de contas ativas", async () => {
    sugerir.mockResolvedValue("conta-inativa");
    renderDialog();
    await waitFor(() => expect(sugerir).toHaveBeenCalled());
    expect(screen.queryByText(/conta da última baixa/i)).not.toBeInTheDocument();
  });

  it("oferece os atalhos de data, incluindo o vencimento do título", async () => {
    sugerir.mockResolvedValue(null);
    renderDialog();
    expect(await screen.findByRole("button", { name: "Hoje" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ontem" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No vencimento" })).toBeInTheDocument();
  });
});
