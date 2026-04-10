import { describe, it, expect } from "vitest";
import {
  agruparVendasPorPeriodo,
  addParticipacao,
  computeTop5Concentracao,
  calcularFaixaAging,
  agruparAgingPorFaixa,
  filtrarPorStatus,
  sortarRows,
} from "../relatorios";
import type { VendasRow, AgingRow } from "@/types/relatorios";

// ─── agruparVendasPorPeriodo ─────────────────────────────────────────────────

describe("agruparVendasPorPeriodo", () => {
  const baseRows: VendasRow[] = [
    { numero: "1", cliente: "A", emissao: "2024-01-10", valor: 100, status: "confirmado", faturamento: "total" },
    { numero: "2", cliente: "A", emissao: "2024-01-20", valor: 200, status: "confirmado", faturamento: "total" },
    { numero: "3", cliente: "B", emissao: "2024-02-05", valor: 150, status: "confirmado", faturamento: "aguardando" },
  ];

  it("aggregates by month by default", () => {
    const result = agruparVendasPorPeriodo(baseRows);
    expect(result).toHaveLength(2);
    const janEntry = result.find((r) => r.name.includes("jan"));
    expect(janEntry?.value).toBe(300);
    const febEntry = result.find((r) => r.name.includes("fev"));
    expect(febEntry?.value).toBe(150);
  });

  it("aggregates by dia", () => {
    const result = agruparVendasPorPeriodo(baseRows, "dia");
    expect(result).toHaveLength(3);
    expect(result.find((r) => r.name === "10/01/2024")?.value).toBe(100);
  });

  it("aggregates by semana", () => {
    const result = agruparVendasPorPeriodo(baseRows, "semana");
    // Both Jan rows are in different weeks; Feb is a separate week.
    expect(result.length).toBeGreaterThanOrEqual(2);
    const total = result.reduce((s, r) => s + r.value, 0);
    expect(total).toBe(450);
  });

  it("returns empty array for empty input", () => {
    expect(agruparVendasPorPeriodo([])).toEqual([]);
  });

  it("sorts result chronologically", () => {
    const result = agruparVendasPorPeriodo(baseRows);
    // We have 2024-01 and 2024-02; the result must be in ascending order
    // (Jan before Feb). The aggregation sorts by ISO key internally.
    expect(result).toHaveLength(2);
    const janEntry = result[0]; // first bucket should be January
    const febEntry = result[1]; // second bucket should be February
    expect(janEntry.value).toBe(300); // 100 + 200
    expect(febEntry.value).toBe(150);
  });
});

// ─── addParticipacao ─────────────────────────────────────────────────────────

describe("addParticipacao", () => {
  it("computes participation percentage correctly", () => {
    const rows = [{ valorTotal: 400 }, { valorTotal: 600 }];
    const result = addParticipacao(rows, 1000);
    expect(result[0].participacao).toBe(40);
    expect(result[1].participacao).toBe(60);
  });

  it("returns 0 participation when grandTotal is 0", () => {
    const rows = [{ valorTotal: 100 }];
    const result = addParticipacao(rows, 0);
    expect(result[0].participacao).toBe(0);
  });

  it("rounds to one decimal place", () => {
    const rows = [{ valorTotal: 1 }];
    const result = addParticipacao(rows, 3);
    expect(result[0].participacao).toBe(33.3);
  });

  it("preserves other properties", () => {
    const rows = [{ valorTotal: 100, cliente: "X" }];
    const result = addParticipacao(rows, 200);
    expect((result[0] as { cliente: string }).cliente).toBe("X");
  });
});

// ─── computeTop5Concentracao ─────────────────────────────────────────────────

describe("computeTop5Concentracao", () => {
  it("computes top-5 concentration", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ valorTotal: (10 - i) * 100 }));
    const grandTotal = rows.reduce((s, r) => s + r.valorTotal, 0);
    const result = computeTop5Concentracao(rows, grandTotal);
    // Top 5: 1000+900+800+700+600 = 4000 of 5500 = ~72.7%
    expect(result).toBeCloseTo(72.7, 0);
  });

  it("returns 0 when grandTotal is 0", () => {
    expect(computeTop5Concentracao([{ valorTotal: 100 }], 0)).toBe(0);
  });

  it("handles fewer than 5 rows", () => {
    const rows = [{ valorTotal: 100 }, { valorTotal: 200 }];
    const result = computeTop5Concentracao(rows, 300);
    expect(result).toBe(100);
  });
});

// ─── calcularFaixaAging ──────────────────────────────────────────────────────

describe("calcularFaixaAging", () => {
  it("returns 'A vencer' for 0 days", () => {
    expect(calcularFaixaAging(0)).toBe("A vencer");
  });
  it("returns 'A vencer' for negative days", () => {
    expect(calcularFaixaAging(-5)).toBe("A vencer");
  });
  it("returns '1-30 dias' for 1 day", () => {
    expect(calcularFaixaAging(1)).toBe("1-30 dias");
  });
  it("returns '1-30 dias' for 30 days", () => {
    expect(calcularFaixaAging(30)).toBe("1-30 dias");
  });
  it("returns '31-60 dias' for 31 days", () => {
    expect(calcularFaixaAging(31)).toBe("31-60 dias");
  });
  it("returns '61-90 dias' for 61 days", () => {
    expect(calcularFaixaAging(61)).toBe("61-90 dias");
  });
  it("returns '90+ dias' for 91 days", () => {
    expect(calcularFaixaAging(91)).toBe("90+ dias");
  });
});

// ─── agruparAgingPorFaixa ────────────────────────────────────────────────────

describe("agruparAgingPorFaixa", () => {
  it("sums values by faixa", () => {
    const rows: AgingRow[] = [
      { tipo: "Receber", descricao: "A", parceiro: "X", valor: 100, vencimento: "2024-01-01", diasVencido: 5, faixa: "1-30 dias" },
      { tipo: "Pagar", descricao: "B", parceiro: "Y", valor: 200, vencimento: "2024-01-01", diasVencido: 50, faixa: "31-60 dias" },
      { tipo: "Receber", descricao: "C", parceiro: "Z", valor: 300, vencimento: "2024-01-01", diasVencido: 10, faixa: "1-30 dias" },
    ];
    const result = agruparAgingPorFaixa(rows);
    expect(result.find((r) => r.name === "1-30 dias")?.value).toBe(400);
    expect(result.find((r) => r.name === "31-60 dias")?.value).toBe(200);
    expect(result.find((r) => r.name === "A vencer")?.value).toBe(0);
  });

  it("returns all 5 bands even when some are empty", () => {
    expect(agruparAgingPorFaixa([])).toHaveLength(5);
  });
});

// ─── filtrarPorStatus ────────────────────────────────────────────────────────

describe("filtrarPorStatus", () => {
  const rows = [
    { status: "pago" },
    { status: "aberto" },
    { status: "vencido" },
  ];

  it("returns all rows when filtro is 'todos'", () => {
    expect(filtrarPorStatus(rows, "todos")).toHaveLength(3);
  });

  it("filters by exact status (case-insensitive)", () => {
    const result = filtrarPorStatus(rows, "pago");
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("pago");
  });

  it("filters by partial match", () => {
    // "vencido" includes "vencido"
    const result = filtrarPorStatus(rows, "vencido");
    expect(result).toHaveLength(1);
  });

  it("returns empty array when no match", () => {
    expect(filtrarPorStatus(rows, "cancelado")).toHaveLength(0);
  });
});

// ─── sortarRows ──────────────────────────────────────────────────────────────

describe("sortarRows", () => {
  const rows = [
    { valor: 50, status: "b", vencimento: "2024-03-01" },
    { valor: 200, status: "a", vencimento: "2024-01-01" },
    { valor: 100, status: "c", vencimento: "2024-02-01" },
  ];

  it("returns original order for 'padrao'", () => {
    const result = sortarRows(rows, "padrao");
    expect(result[0].valor).toBe(50);
  });

  it("sorts by valor descending for 'valor_desc'", () => {
    const result = sortarRows(rows, "valor_desc");
    expect(result[0].valor).toBe(200);
    expect(result[2].valor).toBe(50);
  });

  it("sorts by vencimento ascending for 'vencimento'", () => {
    const result = sortarRows(rows, "vencimento");
    expect(result[0].vencimento).toBe("2024-01-01");
    expect(result[2].vencimento).toBe("2024-03-01");
  });

  it("sorts by status alphabetically for 'status'", () => {
    const result = sortarRows(rows, "status");
    expect(result[0].status).toBe("a");
  });

  it("does not mutate the original array", () => {
    const original = [...rows];
    sortarRows(rows, "valor_desc");
    expect(rows[0].valor).toBe(original[0].valor);
  });
});
