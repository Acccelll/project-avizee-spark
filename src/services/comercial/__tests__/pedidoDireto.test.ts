import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
const upload = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    storage: { from: () => ({ upload: (...args: unknown[]) => upload(...args) }) },
  },
}));

import {
  avisoNumeroMercadoLivre,
  criarPedidoDireto,
  pedidoObrigatorio,
  totalItens,
} from "../pedidoDireto.service";

describe("regras do pedido direto", () => {
  it("número obrigatório só no Mercado Livre e na OC", () => {
    expect(pedidoObrigatorio("mercado_livre")).toBe(true);
    expect(pedidoObrigatorio("email")).toBe(true);
    expect(pedidoObrigatorio("whatsapp")).toBe(false);
    expect(pedidoObrigatorio("telefone")).toBe(false);
  });

  it("avisa quando o nº da venda não parece do Mercado Livre", () => {
    expect(avisoNumeroMercadoLivre("2000001065372652")).toBeNull();
    expect(avisoNumeroMercadoLivre("2000 0010 6537 2652")).toBeNull();
    expect(avisoNumeroMercadoLivre("123456")).toMatch(/16 dígitos/);
    expect(avisoNumeroMercadoLivre("")).toBeNull();
  });

  it("soma só itens com quantidade", () => {
    expect(
      totalItens([
        { produtoId: "p", descricao: "A", quantidade: 2, valorUnitario: 199.99 },
        { produtoId: "q", descricao: "B", quantidade: 0, valorUnitario: 50 },
      ]),
    ).toBe(399.98);
  });
});

describe("criarPedidoDireto", () => {
  beforeEach(() => {
    rpc.mockReset();
    upload.mockReset();
  });

  it("manda os itens para o RPC e usa o ORC quando não há número", async () => {
    rpc.mockResolvedValue({
      data: { id: "o1", numero: "ORC100313", pedido_cliente: "ORC100313", versoes_substituidas: [], canal: "whatsapp" },
      error: null,
    });
    const res = await criarPedidoDireto({
      clienteId: "c1",
      canal: "whatsapp",
      itens: [
        { produtoId: "p1", codigo: "PRD1", descricao: "Agulha", unidade: "DZ", quantidade: 3, valorUnitario: 10 },
        { produtoId: "p2", descricao: "Zerado", quantidade: 0, valorUnitario: 5 },
      ],
      pedidoCliente: "  ",
      dataPedido: "2026-09-27",
      freteValor: 25,
    });
    expect(rpc).toHaveBeenCalledWith("criar_pedido_direto", {
      p_cliente_id: "c1",
      p_canal: "whatsapp",
      p_itens: [{ produto_id: "p1", codigo: "PRD1", descricao: "Agulha", unidade: "DZ", quantidade: 3, valor_unitario: 10 }],
      p_pedido_cliente: undefined,
      p_data_pedido: "2026-09-27",
      p_previsao_despacho: undefined,
      p_frete_valor: 25,
      p_observacoes: undefined,
    });
    expect(res.numero).toBe("ORC100313");
    expect(upload).not.toHaveBeenCalled();
  });

  it("envia o anexo para a pasta do orçamento criado", async () => {
    rpc
      .mockResolvedValueOnce({
        data: { id: "o9", numero: "ORC100320", pedido_cliente: "2000001065372652", versoes_substituidas: [] },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null });
    upload.mockResolvedValue({ error: null });
    const anexo = new File(["x"], "print conversa.png", { type: "image/png" });
    await criarPedidoDireto({
      clienteId: "c1",
      canal: "mercado_livre",
      itens: [{ produtoId: "p1", descricao: "Balança", quantidade: 1, valorUnitario: 1550 }],
      pedidoCliente: "2000001065372652",
      anexo,
    });
    const [path] = upload.mock.calls[0] as [string];
    expect(path).toMatch(/^o9\/pedido-cliente\//);
    expect(rpc.mock.calls[1][0]).toBe("atualizar_pedido_orcamento");
    expect(rpc.mock.calls[1][1]).toMatchObject({ p_id: "o9", p_pedido_cliente: "2000001065372652", p_anexo_path: path });
  });

  it("propaga o erro do banco", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Informe o número da venda do Mercado Livre" } });
    await expect(
      criarPedidoDireto({ clienteId: "c1", canal: "mercado_livre", itens: [{ produtoId: "p", descricao: "x", quantidade: 1, valorUnitario: 1 }] }),
    ).rejects.toThrow("Mercado Livre");
  });
});
