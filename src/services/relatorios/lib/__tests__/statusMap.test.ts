import { describe, it, expect } from "vitest";
import {
  financeiroStatusMap,
  ordemVendaStatusMap,
  faturamentoStatusMap,
  compraStatusMap,
  movimentoEstoqueStatusMap,
  estoqueCriticidadeKind,
  agingFaixaKind,
  curvaAbcClasseKind,
  resolveStatus,
} from "../statusMap";

// ─── financeiroStatusMap ─────────────────────────────────────────────────────

describe("financeiroStatusMap", () => {
  it("maps each canonical status to the expected kind", () => {
    expect(financeiroStatusMap.aberto.kind).toBe("warning");
    expect(financeiroStatusMap.parcial.kind).toBe("info");
    expect(financeiroStatusMap.pago.kind).toBe("success");
    expect(financeiroStatusMap.vencido.kind).toBe("critical");
    expect(financeiroStatusMap.cancelado.kind).toBe("neutral");
    expect(financeiroStatusMap.estornado.kind).toBe("critical");
  });

  it("preserves the canonical key on every entry", () => {
    for (const [k, meta] of Object.entries(financeiroStatusMap)) {
      expect(meta.key).toBe(k);
    }
  });
});

// ─── ordemVendaStatusMap ─────────────────────────────────────────────────────

describe("ordemVendaStatusMap", () => {
  it("treats both 'cancelada' and 'cancelado' as critical (PT gender variants)", () => {
    expect(ordemVendaStatusMap.cancelada.kind).toBe("critical");
    expect(ordemVendaStatusMap.cancelado.kind).toBe("critical");
  });

  it("flags partial billing as warning", () => {
    expect(ordemVendaStatusMap.faturada_parcial.kind).toBe("warning");
  });

  it("treats both 'aprovada' and 'confirmado' as success", () => {
    expect(ordemVendaStatusMap.aprovada.kind).toBe("success");
    expect(ordemVendaStatusMap.confirmado.kind).toBe("success");
  });
});

// ─── faturamentoStatusMap ────────────────────────────────────────────────────

describe("faturamentoStatusMap", () => {
  it("classifies billing progress correctly", () => {
    expect(faturamentoStatusMap.aguardando.kind).toBe("warning");
    expect(faturamentoStatusMap.parcial.kind).toBe("info");
    expect(faturamentoStatusMap.total.kind).toBe("success");
    expect(faturamentoStatusMap.faturado.kind).toBe("success");
  });
});

// ─── compraStatusMap ─────────────────────────────────────────────────────────

describe("compraStatusMap", () => {
  it("treats 'entregue' and 'recebido' as success", () => {
    expect(compraStatusMap.entregue.kind).toBe("success");
    expect(compraStatusMap.recebido.kind).toBe("success");
  });

  it("flags partial as warning", () => {
    expect(compraStatusMap.parcial.kind).toBe("warning");
  });

  it("flags cancelled as critical", () => {
    expect(compraStatusMap.cancelado.kind).toBe("critical");
  });
});

// ─── movimentoEstoqueStatusMap ───────────────────────────────────────────────

describe("movimentoEstoqueStatusMap", () => {
  it("entrada is success, saida is critical, ajuste is warning", () => {
    expect(movimentoEstoqueStatusMap.entrada.kind).toBe("success");
    expect(movimentoEstoqueStatusMap.saida.kind).toBe("critical");
    expect(movimentoEstoqueStatusMap.ajuste.kind).toBe("warning");
  });
});

// ─── estoqueCriticidadeKind ──────────────────────────────────────────────────

describe("estoqueCriticidadeKind", () => {
  it("Zerado → critical", () => {
    expect(estoqueCriticidadeKind("Zerado")).toBe("critical");
  });
  it("Abaixo do mínimo → warning", () => {
    expect(estoqueCriticidadeKind("Abaixo do mínimo")).toBe("warning");
  });
  it("OK → success", () => {
    expect(estoqueCriticidadeKind("OK")).toBe("success");
  });
  it("falls back to success for unknown values", () => {
    expect(estoqueCriticidadeKind("qualquer outro")).toBe("success");
  });
});

// ─── agingFaixaKind ──────────────────────────────────────────────────────────

describe("agingFaixaKind", () => {
  it("'A vencer' → success", () => {
    expect(agingFaixaKind("A vencer")).toBe("success");
  });
  it("'1-30 dias' → warning", () => {
    expect(agingFaixaKind("1-30 dias")).toBe("warning");
  });
  it("'31-60 dias' and '61-90 dias' → critical", () => {
    expect(agingFaixaKind("31-60 dias")).toBe("critical");
    expect(agingFaixaKind("61-90 dias")).toBe("critical");
  });
  it("'90+ dias' → critical", () => {
    expect(agingFaixaKind("90+ dias")).toBe("critical");
  });
  it("unknown → neutral", () => {
    expect(agingFaixaKind("???")).toBe("neutral");
  });
});

// ─── curvaAbcClasseKind ──────────────────────────────────────────────────────

describe("curvaAbcClasseKind", () => {
  it("A is success, B is info, C is warning", () => {
    expect(curvaAbcClasseKind("A")).toBe("success");
    expect(curvaAbcClasseKind("B")).toBe("info");
    expect(curvaAbcClasseKind("C")).toBe("warning");
  });
});

// ─── resolveStatus ───────────────────────────────────────────────────────────

describe("resolveStatus", () => {
  it("returns the mapped meta when key exists", () => {
    expect(resolveStatus(financeiroStatusMap, "pago")).toEqual({
      key: "pago",
      kind: "success",
    });
  });

  it("returns 'desconhecido' / neutral when raw is null/undefined/empty", () => {
    expect(resolveStatus(financeiroStatusMap, null)).toEqual({
      key: "desconhecido",
      kind: "neutral",
    });
    expect(resolveStatus(financeiroStatusMap, undefined)).toEqual({
      key: "desconhecido",
      kind: "neutral",
    });
    expect(resolveStatus(financeiroStatusMap, "")).toEqual({
      key: "desconhecido",
      kind: "neutral",
    });
  });

  it("falls back to neutral preserving the raw key when not found in the map", () => {
    expect(resolveStatus(financeiroStatusMap, "exotico")).toEqual({
      key: "exotico",
      kind: "neutral",
    });
  });

  it("works across different domain maps with the same signature", () => {
    expect(resolveStatus(compraStatusMap, "entregue").kind).toBe("success");
    expect(resolveStatus(ordemVendaStatusMap, "cancelada").kind).toBe("critical");
    expect(resolveStatus(faturamentoStatusMap, "parcial").kind).toBe("info");
  });
});