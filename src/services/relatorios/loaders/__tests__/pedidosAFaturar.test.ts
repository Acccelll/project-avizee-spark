import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { alocarEstoque, type ItemPendente } from "../pedidosAFaturar";

function item(p: Partial<ItemPendente>): ItemPendente {
  return {
    itemId: "i", ordemVendaId: "ov", numero: "OV1", statusOv: "aprovada", cliente: "C",
    emissao: "2026-09-01", previsao: null, produtoId: "p1", codigo: null, produto: "Agulha",
    unidade: "DZ", qtdPedida: 10, qtdFaturada: 0, qtdPendente: 10, valorUnitario: 10,
    estoqueDisponivel: 0, ...p,
  };
}

describe("alocarEstoque", () => {
  it("aloca estoque pela previsão mais próxima e aponta a falta", () => {
    const rows = alocarEstoque(
      [
        item({ itemId: "tarde", ordemVendaId: "b", previsao: "2026-10-05", qtdPendente: 10, estoqueDisponivel: 15 }),
        item({ itemId: "cedo", ordemVendaId: "a", previsao: "2026-09-20", qtdPendente: 10, estoqueDisponivel: 15 }),
      ],
      "2026-09-26",
    );
    expect(rows.map((r) => r.itemId)).toEqual(["cedo", "tarde"]);
    expect(rows[0]).toMatchObject({ qtdAtendida: 10, falta: 0, statusKey: "atendido", atrasado: true });
    expect(rows[1]).toMatchObject({ qtdAtendida: 5, falta: 5, statusKey: "parcial", atrasado: false });
  });

  it("itens sem previsão ficam por último na fila de estoque", () => {
    const rows = alocarEstoque(
      [
        item({ itemId: "sem", previsao: null, qtdPendente: 5, estoqueDisponivel: 5 }),
        item({ itemId: "com", previsao: "2026-12-01", qtdPendente: 5, estoqueDisponivel: 5 }),
      ],
      "2026-09-26",
    );
    expect(rows.find((r) => r.itemId === "com")?.statusKey).toBe("atendido");
    expect(rows.find((r) => r.itemId === "sem")?.statusKey).toBe("sem_estoque");
  });

  it("não compartilha estoque entre produtos e trata item sem cadastro", () => {
    const rows = alocarEstoque(
      [
        item({ itemId: "a", produtoId: "p1", qtdPendente: 3, estoqueDisponivel: 3 }),
        item({ itemId: "b", produtoId: "p2", qtdPendente: 3, estoqueDisponivel: 0 }),
        item({ itemId: "c", produtoId: null, qtdPendente: 2, estoqueDisponivel: null }),
      ],
      "2026-09-26",
    );
    const by = Object.fromEntries(rows.map((r) => [r.itemId, r]));
    expect(by.a.statusKey).toBe("atendido");
    expect(by.b).toMatchObject({ statusKey: "sem_estoque", falta: 3 });
    expect(by.c).toMatchObject({ statusKey: "sem_cadastro", falta: 2 });
  });

  it("estoque negativo é tratado como zero e valor pendente usa o saldo", () => {
    const [r] = alocarEstoque(
      [item({ qtdPedida: 10, qtdFaturada: 4, qtdPendente: 6, valorUnitario: 29.99, estoqueDisponivel: -2 })],
      "2026-09-26",
    );
    expect(r).toMatchObject({ falta: 6, statusKey: "sem_estoque", valorPendente: 179.94 });
  });
});
