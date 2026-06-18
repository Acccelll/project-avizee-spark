import { describe, it, expect } from "vitest";
import {
  isTransicaoComRpc,
  eventoKey,
  filtrarEventosNovos,
  latestPorRemessa,
  base64ToBlob,
} from "../_helpers";

describe("isTransicaoComRpc", () => {
  it("retorna true para transições com side-effect de estoque", () => {
    expect(isTransicaoComRpc("em_transito")).toBe(true);
    expect(isTransicaoComRpc("entregue")).toBe(true);
    expect(isTransicaoComRpc("cancelado")).toBe(true);
  });

  it("retorna false para transições puramente logísticas", () => {
    expect(isTransicaoComRpc("pendente")).toBe(false);
    expect(isTransicaoComRpc("coletado")).toBe(false);
    expect(isTransicaoComRpc("postado")).toBe(false);
    expect(isTransicaoComRpc("ocorrencia")).toBe(false);
    expect(isTransicaoComRpc("devolvido")).toBe(false);
  });
});

describe("eventoKey", () => {
  it("normaliza local nulo para string vazia", () => {
    expect(
      eventoKey({ descricao: "x", local: null, data_hora: "2026-01-01T00:00:00Z" }),
    ).toBe("2026-01-01T00:00:00Z::x::");
  });

  it("é estável e determinístico", () => {
    const e = { descricao: "Entregue", local: "SP", data_hora: "2026-01-02T10:00:00Z" };
    expect(eventoKey(e)).toBe(eventoKey({ ...e }));
  });
});

describe("filtrarEventosNovos", () => {
  const base = (over: Partial<{ descricao: string; local: string | null; data_hora: string }> = {}) => ({
    descricao: "Postado",
    local: "SP",
    data_hora: "2026-01-01T08:00:00Z",
    ...over,
  });

  it("retorna todos quando não há existentes", () => {
    const novos = [base(), base({ descricao: "Em trânsito" })];
    expect(filtrarEventosNovos(novos, [])).toHaveLength(2);
  });

  it("descarta duplicatas por (data_hora, descricao, local)", () => {
    const existentes = [base()];
    const novos = [base(), base({ descricao: "Entregue" })];
    const r = filtrarEventosNovos(novos, existentes);
    expect(r).toHaveLength(1);
    expect(r[0].descricao).toBe("Entregue");
  });

  it("trata local nulo igual a string vazia", () => {
    const r = filtrarEventosNovos(
      [base({ local: null })],
      [base({ local: "" })],
    );
    // null e "" geram a mesma chave → considerado duplicata
    expect(r).toHaveLength(0);
  });

  it("preserva ordem original dos novos", () => {
    const a = base({ descricao: "A" });
    const b = base({ descricao: "B" });
    const c = base({ descricao: "C" });
    expect(filtrarEventosNovos([a, b, c], []).map((e) => e.descricao)).toEqual([
      "A",
      "B",
      "C",
    ]);
  });
});

describe("latestPorRemessa", () => {
  it("mantém o primeiro (mais recente) por remessa_id", () => {
    const rows = [
      { remessa_id: "r1", id: "novo" },
      { remessa_id: "r1", id: "antigo" },
      { remessa_id: "r2", id: "unico" },
    ];
    const r = latestPorRemessa(rows);
    expect(r.r1.id).toBe("novo");
    expect(r.r2.id).toBe("unico");
  });

  it("retorna objeto vazio para lista vazia", () => {
    expect(latestPorRemessa([])).toEqual({});
  });
});

describe("base64ToBlob", () => {
  it("decodifica base64 mantendo tipo e tamanho corretos", () => {
    // "PDF" em base64 → 3 bytes
    const blob = base64ToBlob("UERG");
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBe(3);
  });

  it("blob vazio para input vazio", () => {
    const blob = base64ToBlob("");
    expect(blob.size).toBe(0);
  });

  it("respeita mime customizado", () => {
    const blob = base64ToBlob("UERG", "image/png");
    expect(blob.type).toBe("image/png");
  });
});