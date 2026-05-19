import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataTable } from "@/components/DataTable";

describe("DataTable", () => {
  it("deve mostrar loading quando informado", () => {
    const { container } = render(
      <DataTable
        columns={[{ key: "nome", label: "Nome" }]}
        data={[]}
        loading
      />,
    );

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it("deve mostrar estado vazio", () => {
    render(
      <DataTable
        columns={[{ key: "nome", label: "Nome" }]}
        data={[]}
      />,
    );

    expect(screen.getByText("Nenhum registro encontrado")).toBeInTheDocument();
  });

  it("deve usar o pageSize informado no texto e na navegação server-side", () => {
    render(
      <DataTable
        columns={[{ key: "nome", label: "Nome" }]}
        data={Array.from({ length: 50 }, (_, i) => ({ id: String(i + 1), nome: `Cliente ${i + 1}` }))}
        pageSize={50}
        serverPagination={{
          page: 1,
          setPage: () => undefined,
          totalCount: 112,
          hasMore: true,
        }}
      />,
    );

    expect(screen.getByText("51–100 de 112 registros")).toBeInTheDocument();
    expect(screen.getByLabelText("Página anterior")).toBeInTheDocument();
    expect(screen.getByLabelText("Próxima página")).toBeInTheDocument();
  });

  it("deve ocultar a próxima página na última página server-side", () => {
    render(
      <DataTable
        columns={[{ key: "nome", label: "Nome" }]}
        data={Array.from({ length: 47 }, (_, i) => ({ id: String(i + 101), nome: `Produto ${i + 101}` }))}
        pageSize={50}
        serverPagination={{
          page: 4,
          setPage: () => undefined,
          totalCount: 247,
          hasMore: false,
        }}
      />,
    );

    expect(screen.getByText("201–247 de 247 registros")).toBeInTheDocument();
    expect(screen.getByLabelText("Página anterior")).toBeInTheDocument();
    expect(screen.queryByLabelText("Próxima página")).not.toBeInTheDocument();
  });
});
