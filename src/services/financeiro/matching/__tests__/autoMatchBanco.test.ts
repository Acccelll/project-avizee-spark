import { describe, it, expect } from "vitest";
import {
  autoMatchBanco,
  diasEntreDatas,
  tipoEsperadoPeloSinal,
  type AutoMatchExtrato,
  type AutoMatchLancamento,
} from "../autoMatchBanco";

const ext = (id: string, data: string, valor: number): AutoMatchExtrato => ({ id, data, valor });
const lanc = (
  id: string,
  data: string,
  valor: number,
  tipo: "receber" | "pagar",
): AutoMatchLancamento => ({ id, data_vencimento: data, valor, tipo });

describe("diasEntreDatas", () => {
  it("retorna 0 para datas iguais", () => {
    expect(diasEntreDatas("2026-05-01", "2026-05-01")).toBe(0);
  });
  it("retorna a distância absoluta em dias", () => {
    expect(diasEntreDatas("2026-05-01", "2026-05-05")).toBe(4);
    expect(diasEntreDatas("2026-05-05", "2026-05-01")).toBe(4);
  });
  it("retorna Infinity para datas nulas ou inválidas", () => {
    expect(diasEntreDatas(null, "2026-05-01")).toBe(Number.POSITIVE_INFINITY);
    expect(diasEntreDatas("2026-05-01", undefined)).toBe(Number.POSITIVE_INFINITY);
    expect(diasEntreDatas("xx", "2026-05-01")).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("tipoEsperadoPeloSinal", () => {
  it("crédito → receber; débito → pagar", () => {
    expect(tipoEsperadoPeloSinal(100)).toBe("receber");
    expect(tipoEsperadoPeloSinal(0)).toBe("receber");
    expect(tipoEsperadoPeloSinal(-50)).toBe("pagar");
  });
});

describe("autoMatchBanco", () => {
  it("casa 1↔1 quando valor e data batem", () => {
    const extratos = [ext("e1", "2026-05-01", -100)];
    const lancs = [lanc("l1", "2026-05-01", 100, "pagar")];
    expect(autoMatchBanco(extratos, lancs)).toEqual([
      { extratoId: "e1", lancamentoId: "l1" },
    ]);
  });

  it("respeita o sinal: débito NUNCA casa com título a receber", () => {
    const extratos = [ext("e1", "2026-05-01", -100)];
    const lancs = [lanc("l1", "2026-05-01", 100, "receber")];
    expect(autoMatchBanco(extratos, lancs)).toEqual([]);
  });

  it("aplica tolerância de 0,02 no valor", () => {
    const extratos = [ext("e1", "2026-05-01", -100.01)];
    const lancs = [lanc("l1", "2026-05-01", 100, "pagar")];
    expect(autoMatchBanco(extratos, lancs)).toHaveLength(1);
  });

  it("aceita data dentro da janela ±3 dias por padrão", () => {
    const extratos = [ext("e1", "2026-05-04", -100)];
    const lancs = [lanc("l1", "2026-05-01", 100, "pagar")];
    expect(autoMatchBanco(extratos, lancs)).toHaveLength(1);
  });

  it("recusa data fora da janela", () => {
    const extratos = [ext("e1", "2026-05-10", -100)];
    const lancs = [lanc("l1", "2026-05-01", 100, "pagar")];
    expect(autoMatchBanco(extratos, lancs)).toEqual([]);
  });

  it("soValor=true ignora a data", () => {
    const extratos = [ext("e1", "2026-06-30", -100)];
    const lancs = [lanc("l1", "2026-05-01", 100, "pagar")];
    expect(autoMatchBanco(extratos, lancs, { soValor: true })).toHaveLength(1);
  });

  it("desempata por proximidade de data", () => {
    const extratos = [ext("e1", "2026-05-03", -100)];
    const lancs = [
      lanc("l1", "2026-05-01", 100, "pagar"),
      lanc("l2", "2026-05-04", 100, "pagar"),
    ];
    expect(autoMatchBanco(extratos, lancs)).toEqual([
      { extratoId: "e1", lancamentoId: "l2" },
    ]);
  });

  it("recusa quando há empate exato de distância entre candidatos", () => {
    const extratos = [ext("e1", "2026-05-02", -100)];
    const lancs = [
      lanc("l1", "2026-05-01", 100, "pagar"),
      lanc("l2", "2026-05-03", 100, "pagar"),
    ];
    expect(autoMatchBanco(extratos, lancs)).toEqual([]);
  });

  it("não reutiliza lançamentos bloqueados", () => {
    const extratos = [ext("e1", "2026-05-01", -100)];
    const lancs = [lanc("l1", "2026-05-01", 100, "pagar")];
    expect(
      autoMatchBanco(extratos, lancs, { lancamentosBloqueados: ["l1"] }),
    ).toEqual([]);
  });

  it("não reutiliza o mesmo lançamento em múltiplos extratos", () => {
    const extratos = [
      ext("e1", "2026-05-01", -100),
      ext("e2", "2026-05-01", -100),
    ];
    const lancs = [lanc("l1", "2026-05-01", 100, "pagar")];
    expect(autoMatchBanco(extratos, lancs)).toEqual([
      { extratoId: "e1", lancamentoId: "l1" },
    ]);
  });
});