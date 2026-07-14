import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

// Mock do DataTable para inspecionar os defaults aplicados pelo wrapper fiscal
// sem depender dos providers (permissões, rotas, virtualização) do DS.
const dataTableSpy = vi.fn((_props: Record<string, unknown>) => (
  <div data-testid="dt-mock" />
));
vi.mock("@/components/DataTable", () => ({
  DataTable: (props: Record<string, unknown>) => dataTableSpy(props),
}));

import { FiscalDataGrid } from "../FiscalDataGrid";

describe("FiscalDataGrid", () => {
  it("aplica os defaults fiscais no DataTable", () => {
    render(
      <FiscalDataGrid
        data={[]}
        columns={[{ key: "id", header: "ID" } as never]}
      />,
    );
    expect(dataTableSpy).toHaveBeenCalledTimes(1);
    const props = dataTableSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(props.exportPermission).toBe("relatorios:exportar");
    expect(props.virtualizeThreshold).toBe(50);
    expect(props.maxHeight).toBe(640);
    expect(props.emptyTitle).toMatch(/documento fiscal/i);
    expect(props.emptyDescription).toMatch(/workspace fiscal/i);
  });

  it("permite override das props padrão", () => {
    dataTableSpy.mockClear();
    render(
      <FiscalDataGrid
        data={[]}
        columns={[{ key: "id", header: "ID" } as never]}
        virtualizeThreshold={100}
        emptyTitle="Sem itens"
      />,
    );
    const props = dataTableSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(props.virtualizeThreshold).toBe(100);
    expect(props.emptyTitle).toBe("Sem itens");
    // defaults não sobrescritos continuam
    expect(props.exportPermission).toBe("relatorios:exportar");
  });
});