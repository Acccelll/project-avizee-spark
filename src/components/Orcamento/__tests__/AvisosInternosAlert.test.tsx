import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const listAvisosInternosProdutos = vi.fn();
vi.mock("@/services/produtos.service", () => ({
  listAvisosInternosProdutos: (ids: string[]) => listAvisosInternosProdutos(ids),
}));

import { AvisosInternosAlert } from "../AvisosInternosAlert";
import { agruparAvisosInternos } from "@/lib/avisosInternos";

const agulha = (id: string, codigo: string) => ({
  produtoId: id, codigo, nome: `AGULHA ${codigo}`, grupo: "AGULHA", aviso: "Informar o lote",
});

function renderAlert(produtoIds: Array<string | null>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AvisosInternosAlert produtoIds={produtoIds} />
    </QueryClientProvider>,
  );
}

describe("agruparAvisosInternos", () => {
  it("agrupa itens pelo texto do aviso, sem repetir produto", () => {
    const grupos = agruparAvisosInternos([
      agulha("p1", "AG011"),
      agulha("p2", "AG021"),
      agulha("p1", "AG011"),
      { produtoId: "p3", codigo: null, nome: "Vacinador", grupo: "VACINADOR", aviso: "informar o lote" },
    ]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].aviso).toBe("Informar o lote");
    expect(grupos[0].itens.map((i) => i.rotulo)).toEqual(["AG011 – AGULHA AG011", "AG021 – AGULHA AG021", "Vacinador"]);
  });
});

describe("AvisosInternosAlert", () => {
  it("mostra o aviso e os itens quando algum produto do grupo está no pedido", async () => {
    listAvisosInternosProdutos.mockResolvedValue([agulha("p1", "AG011")]);
    renderAlert(["p1", "p9", null, "p1"]);
    expect(await screen.findByText("Informar o lote")).toBeInTheDocument();
    expect(screen.getByText("AG011 – AGULHA AG011")).toBeInTheDocument();
    expect(screen.getByText(/não aparece/)).toBeInTheDocument();
    // Consulta uma vez por produto distinto, ignorando linhas vazias.
    expect(listAvisosInternosProdutos).toHaveBeenLastCalledWith(["p1", "p9"]);
  });

  it("não renderiza nada sem itens com aviso", async () => {
    listAvisosInternosProdutos.mockResolvedValue([]);
    const { container } = renderAlert(["p9"]);
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
  });

  it("não consulta quando o orçamento não tem produtos", () => {
    listAvisosInternosProdutos.mockClear();
    const { container } = renderAlert([null, ""]);
    expect(container).toBeEmptyDOMElement();
    expect(listAvisosInternosProdutos).not.toHaveBeenCalled();
  });
});
