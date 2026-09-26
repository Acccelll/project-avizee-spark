import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const registrar = vi.fn();
const duplicados = vi.fn();
vi.mock("@/services/comercial/pedidoOrcamento.service", async (orig) => {
  const real = await orig<typeof import("@/services/comercial/pedidoOrcamento.service")>();
  return {
    ...real,
    registrarPedidoOrcamento: (...a: unknown[]) => registrar(...a),
    atualizarPedidoOrcamento: vi.fn(),
    buscarPedidosDuplicados: (...a: unknown[]) => duplicados(...a),
  };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import { RegistrarPedidoDialog } from "../RegistrarPedidoDialog";

const orc = {
  id: "o1",
  numero: "ORC100306",
  cliente_id: "c1",
  clienteNome: "PLUMA AGRO",
  clienteCpfCnpj: "00.000.000/0001-00",
  valor_total: 1216.25,
  prazo_entrega_dias: 10,
};

describe("RegistrarPedidoDialog", () => {
  beforeEach(() => {
    registrar.mockReset();
    duplicados.mockReset().mockResolvedValue([]);
  });

  it("sugere a previsão pelo prazo de entrega e exige o número do pedido", () => {
    render(<RegistrarPedidoDialog open onClose={() => {}} orcamento={orc} />);
    const data = screen.getByLabelText("Data do pedido") as HTMLInputElement;
    fireEvent.change(data, { target: { value: "2026-09-26" } });
    expect((screen.getByLabelText("Previsão de despacho") as HTMLInputElement).value).toBe("2026-10-06");
    expect(screen.getByRole("button", { name: "Registrar pedido" })).toBeDisabled();
  });

  it("usar o nº do orçamento libera o registro sem número do cliente", async () => {
    registrar.mockResolvedValue({ id: "o1", numero: "ORC100306", pedido_cliente: "ORC100306", versoes_substituidas: [] });
    const onDone = vi.fn();
    render(<RegistrarPedidoDialog open onClose={() => {}} orcamento={orc} onDone={onDone} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect((screen.getByLabelText("Nº do pedido do cliente / OC") as HTMLInputElement).value).toBe("ORC100306");
    fireEvent.click(screen.getByRole("button", { name: "Registrar pedido" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(registrar.mock.calls[0][0]).toMatchObject({ orcamentoId: "o1", pedidoCliente: null });
  });

  it("avisa quando o mesmo pedido já existe para o cliente", async () => {
    duplicados.mockResolvedValue([{ id: "o0", numero: "ORC100279", status: "aprovado" }]);
    render(<RegistrarPedidoDialog open onClose={() => {}} orcamento={orc} />);
    fireEvent.change(screen.getByLabelText("Nº do pedido do cliente / OC"), { target: { value: "30725" } });
    expect(await screen.findByText(/ORC100279 \(Pedido\)/)).toBeInTheDocument();
  });
});
