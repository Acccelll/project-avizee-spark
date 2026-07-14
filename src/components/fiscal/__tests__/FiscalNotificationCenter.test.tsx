import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FiscalNotificationCenter } from "../FiscalNotificationCenter";
import type { DashboardFiscalKpis } from "@/services/fiscal/dashboardFiscal.service";

function makeKpis(overrides: Partial<DashboardFiscalKpis> = {}): DashboardFiscalKpis {
  return {
    saida: { autorizadas: 10, rejeitadas: 0, canceladas: 0, pendentes: 0 },
    entrada: { total: 5, semManifestacao: 0 },
    empresa: { contingenciaAtiva: false },
    ...overrides,
  } as DashboardFiscalKpis;
}

describe("FiscalNotificationCenter", () => {
  it("mostra apenas o sino, sem badge, quando não há KPIs", () => {
    render(<FiscalNotificationCenter kpis={undefined} />);
    const btn = screen.getByRole("button", { name: /notificações fiscais \(0\)/i });
    expect(btn).toBeInTheDocument();
    expect(btn.querySelector(".absolute")).toBeNull();
  });

  it("não renderiza badge quando não há alertas derivados", () => {
    render(<FiscalNotificationCenter kpis={makeKpis()} />);
    expect(
      screen.getByRole("button", { name: /notificações fiscais \(0\)/i }),
    ).toBeInTheDocument();
  });

  it("exibe contagem e usa variante destructive quando há crítica", () => {
    render(
      <FiscalNotificationCenter
        kpis={makeKpis({
          saida: { autorizadas: 1, rejeitadas: 3, canceladas: 0, pendentes: 0 },
          entrada: { total: 5, semManifestacao: 2 },
        })}
      />,
    );
    const btn = screen.getByRole("button", { name: /notificações fiscais \(2\)/i });
    expect(btn).toBeInTheDocument();
    // Badge com "2" visível
    expect(btn.textContent).toContain("2");
  });

  it("usa variante secondary quando só há avisos", () => {
    render(
      <FiscalNotificationCenter
        kpis={makeKpis({ entrada: { total: 5, semManifestacao: 1 } })}
      />,
    );
    expect(
      screen.getByRole("button", { name: /notificações fiscais \(1\)/i }),
    ).toBeInTheDocument();
  });
});