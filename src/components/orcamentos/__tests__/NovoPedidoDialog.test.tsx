import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const criar = vi.fn();
vi.mock("@/services/comercial/pedidoDireto.service", async (orig) => {
  const real = await orig<typeof import("@/services/comercial/pedidoDireto.service")>();
  return {
    ...real,
    criarPedidoDireto: (...a: unknown[]) => criar(...a),
    ultimosPrecosDoCliente: vi.fn().mockResolvedValue(new Map([["p1", 45]])),
  };
});
vi.mock("@/services/comercial/pedidoOrcamento.service", async (orig) => {
  const real = await orig<typeof import("@/services/comercial/pedidoOrcamento.service")>();
  return { ...real, buscarPedidosDuplicados: vi.fn().mockResolvedValue([]) };
});
vi.mock("@/services/orcamentos.service", () => ({
  listClientesAtivosOrcamento: vi.fn().mockResolvedValue([
    { id: "c1", nome_razao_social: "Comprador Silva", nome_fantasia: null, cpf_cnpj: "123.456.789-09", cidade: "Bastos", uf: "SP" },
  ]),
  listProdutosAtivosComFornecedores: vi.fn().mockResolvedValue([
    { id: "p1", nome: "Agulha inox", codigo_interno: "PRD000054", unidade_medida: "DZ", preco_venda: 40 },
  ]),
}));
vi.mock("@/components/QuickAddClientModal", () => ({ QuickAddClientModal: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import { NovoPedidoDialog } from "../NovoPedidoDialog";

function renderDialog(onDone = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  render(<NovoPedidoDialog open onClose={() => {}} onDone={onDone} />, { wrapper });
  return onDone;
}

async function escolherClienteEProduto() {
  const busca = screen.getByPlaceholderText(/^Buscar (por nome ou CNPJ|comprador)/);
  fireEvent.focus(busca);
  fireEvent.change(busca, { target: { value: "Silva" } });
  fireEvent.click(await screen.findByText("Comprador Silva"));
  const produto = screen.getByPlaceholderText("Buscar produto…");
  fireEvent.focus(produto);
  fireEvent.change(produto, { target: { value: "Agulha" } });
  fireEvent.mouseDown(await screen.findByText("Agulha inox"));
}

describe("NovoPedidoDialog", () => {
  beforeEach(() => criar.mockReset());

  it("só libera o registro com cliente e item; sugere o último preço do cliente", async () => {
    const onDone = renderDialog();
    const botao = screen.getByRole("button", { name: /Registrar pedido/ });
    expect(botao).toBeDisabled();
    expect(screen.getByText(/Falta: cliente, pelo menos um item/)).toBeInTheDocument();

    await escolherClienteEProduto();
    await waitFor(() => expect((screen.getByLabelText("Preço unitário") as HTMLInputElement).value).toBe("45"));
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "3" } });
    expect(botao).toBeEnabled();

    criar.mockResolvedValue({ id: "o1", numero: "ORC100313", pedido_cliente: "ORC100313", versoes_substituidas: [], canal: "whatsapp" });
    fireEvent.click(botao);
    await waitFor(() => expect(onDone).toHaveBeenCalledWith("o1"));
    expect(criar.mock.calls[0][0]).toMatchObject({
      clienteId: "c1",
      canal: "whatsapp",
      pedidoCliente: null,
      itens: [{ produtoId: "p1", codigo: "PRD000054", descricao: "Agulha inox", unidade: "DZ", quantidade: 3, valorUnitario: 45 }],
    });
  });

  it("Mercado Livre exige o nº da venda e avisa formato estranho", async () => {
    renderDialog();
    fireEvent.click(screen.getByRole("radio", { name: "Mercado Livre" }));
    await escolherClienteEProduto();
    expect(screen.getByText(/Falta: nº da venda/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nº da venda no Mercado Livre"), { target: { value: "12345" } });
    expect(screen.getByText(/16 dígitos/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Registrar pedido/ })).toBeEnabled();
  });
});
