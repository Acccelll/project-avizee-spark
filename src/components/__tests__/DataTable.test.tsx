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
});
