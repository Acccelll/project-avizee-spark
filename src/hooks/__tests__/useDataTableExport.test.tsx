import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDataTableExport } from "@/hooks/useDataTableExport";

const mocks = vi.hoisted(() => ({
  exportCsv: vi.fn(),
  exportExcel: vi.fn(),
  exportPdf: vi.fn(),
  toastLoading: vi.fn(() => "export-toast"),
  toastWarning: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/services/export.service", () => ({
  exportarParaCsv: mocks.exportCsv,
  exportarParaExcel: mocks.exportExcel,
  exportarParaPdf: mocks.exportPdf,
}));

vi.mock("@/hooks/useCan", () => ({
  useCan: () => ({ can: () => true }),
}));

vi.mock("sonner", () => ({
  toast: {
    loading: mocks.toastLoading,
    warning: mocks.toastWarning,
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

describe("useDataTableExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exporta todos os registros fornecidos pelo loader, e não somente a página atual", async () => {
    const pageRows = [{ id: "51", nome: "Cliente 51" }];
    const allFilteredRows = [
      { id: "1", nome: "Cliente 1" },
      { id: "51", nome: "Cliente 51" },
      { id: "101", nome: "Cliente 101" },
    ];
    const loadRows = vi.fn().mockResolvedValue(allFilteredRows);

    const { result } = renderHook(() =>
      useDataTableExport({
        rows: pageRows,
        columns: [
          { key: "id", label: "ID" },
          { key: "nome", label: "Nome" },
        ],
        titulo: "clientes",
        loadRows,
      }),
    );

    await act(async () => {
      await result.current.exportData("csv");
    });

    expect(loadRows).toHaveBeenCalledTimes(1);
    expect(mocks.exportCsv).toHaveBeenCalledWith({
      titulo: "clientes",
      rows: [
        { ID: "1", Nome: "Cliente 1" },
        { ID: "51", Nome: "Cliente 51" },
        { ID: "101", Nome: "Cliente 101" },
      ],
    });
  });
});
