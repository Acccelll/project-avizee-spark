import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FiscalBreadcrumb } from "@/components/fiscal/FiscalBreadcrumb";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <FiscalBreadcrumb />
    </MemoryRouter>,
  );
}

describe("FiscalBreadcrumb", () => {
  it("não renderiza fora de /fiscal", () => {
    const { container } = renderAt("/dashboard");
    expect(container).toBeEmptyDOMElement();
  });

  it("não renderiza no root de /fiscal (sem sub-rota)", () => {
    const { container } = renderAt("/fiscal");
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza trilha com aria-current na última", () => {
    renderAt("/fiscal/central");
    const nav = screen.getByRole("navigation", { name: /trilha/i });
    expect(nav).toBeInTheDocument();
    expect(screen.getByText("Central")).toHaveAttribute("aria-current", "page");
    // Fiscal deve ser link, não current
    const fiscalLink = screen.getByRole("link", { name: "Fiscal" });
    expect(fiscalLink).toHaveAttribute("href", "/fiscal");
  });

  it("aplica label amigável para slugs conhecidos", () => {
    renderAt("/fiscal/distdfe-historico");
    expect(screen.getByText("Histórico DF-e")).toBeInTheDocument();
  });
});