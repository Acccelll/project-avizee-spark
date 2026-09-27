import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { useRelatorioDrillDown } from "../useRelatorioDrillDown";

const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

describe("useRelatorioDrillDown", () => {
  it("põe o ID no caminho quando a rota tem :id e usa ?focus nas demais", () => {
    const { result } = renderHook(() => useRelatorioDrillDown("pedidos_a_faturar"), { wrapper });
    const actions = result.current.getRowActions({ orcamentoId: "o1", clienteId: "c1", produtoId: null });
    expect(actions.map((a) => a.href)).toEqual(["/orcamentos/o1", "/clientes?focus=c1"]);
  });
});
