import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
const upload = vi.fn();
const select = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    storage: { from: () => ({ upload: (...args: unknown[]) => upload(...args) }) },
    from: () => ({ select: () => ({ not: () => ({ neq: () => select() }) }) }),
  },
}));

import {
  buscarPedidosDuplicados,
  normalizarPedido,
  raizDocumento,
  registrarPedidoOrcamento,
  sugerirPrevisaoDespacho,
} from "../pedidoOrcamento.service";
import { canRegistrarPedido } from "@/lib/comercialWorkflow";

describe("normalizarPedido", () => {
  it("ignora pontuação, espaços e zeros à esquerda", () => {
    expect(normalizarPedido("1.181")).toBe("1181");
    expect(normalizarPedido(" 01181 ")).toBe("1181");
    expect(normalizarPedido("orc100291")).toBe("ORC100291");
    expect(normalizarPedido(null)).toBe("");
  });
});

describe("raizDocumento", () => {
  it("usa os 8 primeiros dígitos do CNPJ e o CPF inteiro", () => {
    expect(raizDocumento("00.466.591/0003-10")).toBe("00466591");
    expect(raizDocumento("123.456.789-09")).toBe("12345678909");
  });
});

describe("sugerirPrevisaoDespacho", () => {
  it("soma o prazo de entrega à data do pedido", () => {
    expect(sugerirPrevisaoDespacho("2026-09-26", 10)).toBe("2026-10-06");
    expect(sugerirPrevisaoDespacho("2026-12-28", 5)).toBe("2027-01-02");
  });
  it("sem prazo não sugere", () => {
    expect(sugerirPrevisaoDespacho("2026-09-26", null)).toBe("");
    expect(sugerirPrevisaoDespacho("", 10)).toBe("");
  });
});

describe("canRegistrarPedido", () => {
  it("rascunho e enviado viram pedido direto; pedido registrado não", () => {
    expect(canRegistrarPedido("rascunho")).toBe(true);
    expect(canRegistrarPedido("pendente")).toBe(true);
    expect(canRegistrarPedido("aprovado", null)).toBe(true);
    expect(canRegistrarPedido("aprovado", "2026-09-26T10:00:00Z")).toBe(false);
    expect(canRegistrarPedido("historico")).toBe(false);
    expect(canRegistrarPedido("cancelado")).toBe(false);
  });
});

describe("registrarPedidoOrcamento", () => {
  beforeEach(() => {
    rpc.mockReset();
    upload.mockReset();
  });

  it("sem número manda o pedido vazio para o RPC usar o nº do orçamento", async () => {
    rpc.mockResolvedValue({ data: { id: "o1", numero: "ORC1", pedido_cliente: "ORC1", versoes_substituidas: [] }, error: null });
    const res = await registrarPedidoOrcamento({ orcamentoId: "o1", pedidoCliente: "  ", dataPedido: "2026-09-26", previsaoDespacho: null });
    expect(rpc).toHaveBeenCalledWith("registrar_pedido_orcamento", {
      p_id: "o1",
      p_pedido_cliente: undefined,
      p_data_pedido: "2026-09-26",
      p_previsao_despacho: undefined,
      p_anexo_path: undefined,
    });
    expect(res.pedido_cliente).toBe("ORC1");
    expect(upload).not.toHaveBeenCalled();
  });

  it("envia o anexo para a pasta do orçamento antes de registrar", async () => {
    upload.mockResolvedValue({ error: null });
    rpc.mockResolvedValue({ data: { id: "o1", numero: "ORC1", pedido_cliente: "4500", versoes_substituidas: [] }, error: null });
    const file = new File(["%PDF"], "Pedido Cobb nº 4500.pdf", { type: "application/pdf" });
    await registrarPedidoOrcamento({ orcamentoId: "o1", pedidoCliente: "4500", dataPedido: null, previsaoDespacho: null, anexo: file });
    const [path] = upload.mock.calls[0] as [string];
    expect(path).toMatch(/^o1\/pedido-cliente\/\d+-Pedido_Cobb_n_4500\.pdf$/);
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_pedido_cliente: "4500", p_anexo_path: path });
  });

  it("propaga o erro do banco", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Só orçamentos em rascunho ou enviados podem virar pedido" } });
    await expect(
      registrarPedidoOrcamento({ orcamentoId: "o1", pedidoCliente: "1", dataPedido: null, previsaoDespacho: null }),
    ).rejects.toThrow("Só orçamentos em rascunho");
  });
});

describe("buscarPedidosDuplicados", () => {
  it("acha o mesmo pedido em filial do mesmo cliente e ignora outros clientes", async () => {
    select.mockResolvedValue({
      data: [
        { id: "a", numero: "ORC10", status: "aprovado", cliente_id: "c2", pedido_cliente: "4500.120", clientes: { cpf_cnpj: "00.466.591/0003-10" } },
        { id: "b", numero: "ORC11", status: "aprovado", cliente_id: "c9", pedido_cliente: "4500120", clientes: { cpf_cnpj: "99.999.999/0001-00" } },
        { id: "c", numero: "ORC12", status: "aprovado", cliente_id: "c1", pedido_cliente: "777", clientes: { cpf_cnpj: "00.466.591/0001-49" } },
      ],
      error: null,
    });
    const rows = await buscarPedidosDuplicados({
      orcamentoId: "x",
      clienteId: "c1",
      clienteCpfCnpj: "00.466.591/0001-49",
      pedidoCliente: "04500120",
    });
    expect(rows).toEqual([{ id: "a", numero: "ORC10", status: "aprovado" }]);
  });
});

describe("resumoVinculoAutomatico", () => {
  it("resume cada resultado do vínculo automático", async () => {
    const { resumoVinculoAutomatico } = await import("../vinculoNfPedido.service");
    expect(resumoVinculoAutomatico({
      status: "vinculado",
      vinculados: [{ orcamento_id: "o", numero: "ORC1", pedido_cliente: "4500", referencia: "4500", faturamento_status: "parcial" }],
    })).toEqual({ tipo: "success", texto: "NF ligada ao pedido 4500 (ORC1)." });
    expect(resumoVinculoAutomatico({
      status: "pedido_nao_registrado", vinculados: [],
      pendentes: [{ orcamento_id: "o", numero: "ORC100500", referencia: "ORC100500", status: "rascunho" }],
    })?.tipo).toBe("warning");
    expect(resumoVinculoAutomatico({
      status: "sugestao", vinculados: [], sugestoes: [{ orcamento_id: "o", numero: "ORC5", motivo: "valor" }],
    })?.texto).toContain("ORC5");
    expect(resumoVinculoAutomatico({ status: "sem_pedido", vinculados: [] })).toBeNull();
  });
});
