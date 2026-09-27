import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { agruparPorCliente, agruparPorProduto, alocarEstoque, type ItemPendente } from "../pedidosAFaturar";

function item(p: Partial<ItemPendente>): ItemPendente {
  return {
    itemId: "i", orcamentoId: "o", pedido: "4500", orcamento: "ORC1", canal: "Orçamento", clienteId: "c", cliente: "C",
    emissao: "2026-09-01", previsao: null, produtoId: "p1", codigo: null, produto: "Agulha",
    unidade: "DZ", qtdPedida: 10, qtdFaturada: 0, qtdPendente: 10, valorUnitario: 10,
    estoqueDisponivel: 0, ...p,
  };
}

describe("alocarEstoque", () => {
  it("aloca estoque pela previsão mais próxima e aponta a falta", () => {
    const rows = alocarEstoque(
      [
        item({ itemId: "tarde", orcamentoId: "b", previsao: "2026-10-05", qtdPendente: 10, estoqueDisponivel: 15 }),
        item({ itemId: "cedo", orcamentoId: "a", previsao: "2026-09-20", qtdPendente: 10, estoqueDisponivel: 15 }),
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

describe("visões por cliente e por produto", () => {
  const hoje = "2026-09-26";
  const rows = alocarEstoque(
    [
      item({ itemId: "1", orcamentoId: "o1", clienteId: "c1", cliente: "Cobb", produtoId: "p1", previsao: "2026-09-20", qtdPendente: 10, valorUnitario: 10, estoqueDisponivel: 12 }),
      item({ itemId: "2", orcamentoId: "o2", clienteId: "c1", cliente: "Cobb", produtoId: "p2", previsao: "2026-10-10", qtdPendente: 4, valorUnitario: 50, estoqueDisponivel: 0 }),
      item({ itemId: "3", orcamentoId: "o3", clienteId: "c2", cliente: "Nutriza", produtoId: "p1", previsao: "2026-10-01", qtdPendente: 5, valorUnitario: 10, estoqueDisponivel: 12 }),
    ],
    hoje,
  );

  it("por cliente soma a carteira e mostra a pior situação", () => {
    const [cobb, nutriza] = agruparPorCliente(rows);
    expect(cobb).toMatchObject({
      cliente: "Cobb", pedidos: 2, itens: 2, valorPendente: 300, itensComFalta: 1,
      atrasados: 1, previsao: "2026-09-20", statusKey: "sem_estoque", statusKind: "critical",
    });
    // p1 tem 12 em estoque: 10 vão para a Cobb (previsão mais cedo), sobram 2 dos 5.
    expect(nutriza).toMatchObject({ pedidos: 1, itensComFalta: 1, statusKey: "parcial" });
  });

  it("por produto mostra quanto está pedido e quanto falta", () => {
    const porProduto = agruparPorProduto(rows);
    const p1 = porProduto.find((p) => p.produtoId === "p1");
    const p2 = porProduto.find((p) => p.produtoId === "p2");
    expect(p1).toMatchObject({ pedidos: 2, qtdPendente: 15, estoqueDisponivel: 12, falta: 3, statusKey: "parcial" });
    expect(p2).toMatchObject({ pedidos: 1, qtdPendente: 4, falta: 4, statusKey: "sem_estoque" });
    // Ordena pelo que mais falta.
    expect(porProduto[0].produtoId).toBe("p2");
  });
});
