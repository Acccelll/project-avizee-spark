import { describe, it, expect } from "vitest";
import {
  monthRange,
  monthLabel,
  priorYearMonth,
  variation,
  aggregateQuarter,
  indexByCompetencia,
} from "../comparators";

describe("workbook/comparators", () => {
  describe("monthRange", () => {
    it("gera meses dentro do mesmo ano", () => {
      expect(monthRange("2025-01-01", "2025-04-30")).toEqual([
        "2025-01",
        "2025-02",
        "2025-03",
        "2025-04",
      ]);
    });

    it("atravessa virada de ano corretamente", () => {
      expect(monthRange("2024-11-15", "2025-02-10")).toEqual([
        "2024-11",
        "2024-12",
        "2025-01",
        "2025-02",
      ]);
    });

    it("retorna mês único quando início e fim estão no mesmo mês", () => {
      expect(monthRange("2025-06-01", "2025-06-30")).toEqual(["2025-06"]);
    });
  });

  describe("monthLabel", () => {
    it("formata YYYY-MM como Mmm/AA em português", () => {
      expect(monthLabel("2025-01")).toBe("Jan/25");
      expect(monthLabel("2024-12")).toBe("Dez/24");
      expect(monthLabel("2026-07")).toBe("Jul/26");
    });
  });

  describe("priorYearMonth", () => {
    it("subtrai exatamente 1 ano mantendo o mês", () => {
      expect(priorYearMonth("2025-03")).toBe("2024-03");
      expect(priorYearMonth("2026-01")).toBe("2025-01");
    });
  });

  describe("variation", () => {
    it("retorna 0 quando a base é zero (evita divisão por zero)", () => {
      expect(variation(100, 0)).toBe(0);
    });

    it("calcula crescimento positivo", () => {
      expect(variation(150, 100)).toBeCloseTo(0.5);
    });

    it("calcula queda como valor negativo", () => {
      expect(variation(80, 100)).toBeCloseTo(-0.2);
    });

    it("usa o módulo da base quando ela é negativa", () => {
      // base negativa: variação relativa ao módulo
      expect(variation(-50, -100)).toBeCloseTo(0.5);
    });
  });

  describe("aggregateQuarter", () => {
    it("agrega 12 meses em trimestres + YTD", () => {
      const valores = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];
      const r = aggregateQuarter(valores);
      expect(r.q1).toBe(60);
      expect(r.q2).toBe(150);
      expect(r.q3).toBe(240);
      expect(r.q4).toBe(330);
      expect(r.ytd).toBe(780);
    });

    it("preenche zeros nos trimestres sem dados", () => {
      const r = aggregateQuarter([1, 2, 3]);
      expect(r.q1).toBe(6);
      expect(r.q2).toBe(0);
      expect(r.q3).toBe(0);
      expect(r.q4).toBe(0);
      expect(r.ytd).toBe(6);
    });
  });

  describe("indexByCompetencia", () => {
    it("agrega valores por competência YYYY-MM", () => {
      const arr = [
        { competencia: "2025-01-15", valor: 100 },
        { competencia: "2025-01-28", valor: 50 },
        { competencia: "2025-02-05", valor: 200 },
      ];
      const out = indexByCompetencia(arr, (i) => i.valor);
      expect(out["2025-01"]).toBe(150);
      expect(out["2025-02"]).toBe(200);
    });

    it("retorna objeto vazio para entrada vazia", () => {
      expect(indexByCompetencia([], (i: { competencia: string }) => 1)).toEqual({});
    });
  });
});