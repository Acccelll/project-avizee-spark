import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchAllPages = vi.fn();
vi.mock("@/services/relatorios/lib/fetchAllPages", () => ({
  fetchAllPages: (...args: unknown[]) => fetchAllPages(...args),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { loadFaturamento, loadVendas } from "../comercial";

describe("relatórios comerciais lendo pedidos dos orçamentos", () => {
  beforeEach(() => fetchAllPages.mockReset());

  it("Vendas usa o pedido do cliente e a situação de faturamento do orçamento", async () => {
    fetchAllPages.mockResolvedValue([
      { id: "o1", cliente_id: "c1", numero: "ORC100305", pedido_cliente: "4500120465", data_pedido_cliente: "2026-09-20",
        data_orcamento: "2026-09-15", valor_total: 8240, status: "aprovado", faturamento_status: "parcial",
        clientes: { nome_razao_social: "COBB" } },
      { id: "o2", cliente_id: "c2", numero: "ORC100212", pedido_cliente: null, data_pedido_cliente: null,
        data_orcamento: "2025-10-01", valor_total: 100, status: "historico", faturamento_status: "faturado",
        clientes: { nome_razao_social: "FREDI" } },
    ]);
    const res = await loadVendas({});
    expect(res.rows[0]).toMatchObject({
      orcamentoId: "o1", numero: "4500120465", orcamento: "ORC100305", emissao: "2026-09-20",
      faturamento: "Faturado parcial", statusKey: "parcial", statusKind: "info",
    });
    expect(res.rows[1]).toMatchObject({ numero: "ORC100212", emissao: "2025-10-01", statusKey: "faturado" });
    expect(res.kpis).toMatchObject({ qtdPedidos: 2, aguardandoFaturamento: 1, totalVendido: 8340 });
  });

  it("Faturamento mostra os pedidos ligados à NF e abre o primeiro", async () => {
    fetchAllPages.mockResolvedValue([
      { id: "nf1", cliente_id: "c1", numero: "348", serie: "100", data_emissao: "2026-06-01", valor_total: 16818.7,
        modelo_documento: "55", clientes: { nome_razao_social: "COBB" },
        orcamento_nf_vinculos: [
          { orcamento_id: "o1", orcamentos: { numero: "ORC1", pedido_cliente: "4500112736" } },
          { orcamento_id: "o2", orcamentos: { numero: "ORC2", pedido_cliente: null } },
        ] },
      { id: "nf2", cliente_id: "c2", numero: "2", serie: "200", data_emissao: "2025-02-05", valor_total: 1550,
        modelo_documento: "55", clientes: null, orcamento_nf_vinculos: [] },
    ]);
    const res = await loadFaturamento({});
    expect(res.rows[0]).toMatchObject({ pedido: "4500112736, ORC2", orcamentoId: "o1" });
    expect(res.rows[1]).toMatchObject({ pedido: "—", orcamentoId: undefined });
  });
});
