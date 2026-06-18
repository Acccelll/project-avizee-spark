import { describe, it, expect } from "vitest";
import {
  calcularSimilaridade,
  calcularScoreConciliacao,
  sugerirConciliacao,
  type TituloParaConciliacao,
} from "../conciliacao.service";
import type { TransacaoExtrato } from "../ofxParser.service";

function titulo(over: Partial<TituloParaConciliacao> = {}): TituloParaConciliacao {
  return {
    id: "t-1",
    descricao: "PIX RECEB CLIENTE ACME",
    valor: 1000,
    data_vencimento: "2026-01-10",
    data_baixa: "2026-01-10",
    tipo: "receber",
    status: "baixado",
    ...over,
  };
}

function transacao(over: Partial<TransacaoExtrato> = {}): TransacaoExtrato {
  return {
    id: "x-1",
    data: "2026-01-10",
    valor: 1000,
    descricao: "PIX RECEBIDO CLIENTE ACME",
    tipo: "credito",
    ...(over as TransacaoExtrato),
  } as TransacaoExtrato;
}

describe("calcularSimilaridade", () => {
  it("retorna 1 para strings idênticas após normalização", () => {
    expect(calcularSimilaridade("PIX RECEB", "pix receb")).toBe(1);
  });

  it("ignora referências numéricas longas e acentos", () => {
    const score = calcularSimilaridade(
      "TED CRÉDITO 1234567890 CLIENTE",
      "ted credito cliente",
    );
    expect(score).toBeGreaterThan(0.8);
  });

  it("retorna 0 para strings vazias", () => {
    expect(calcularSimilaridade("", "qualquer")).toBe(0);
    expect(calcularSimilaridade("abc", "")).toBe(0);
  });

  it("retorna valor baixo para strings completamente distintas", () => {
    expect(calcularSimilaridade("alpha bravo", "xyz delta")).toBeLessThan(0.2);
  });
});

describe("calcularScoreConciliacao", () => {
  it("retorna 0 quando o valor diverge mais que 1 centavo", () => {
    expect(calcularScoreConciliacao(transacao(), titulo({ valor: 1001 }))).toBe(0);
  });

  it("aceita diferenças menores que 1 centavo", () => {
    const s = calcularScoreConciliacao(
      transacao({ valor: 1000 }),
      titulo({ valor: 1000.005 }),
    );
    expect(s).toBeGreaterThan(0);
  });

  it("ignora títulos em aberto sem data_baixa", () => {
    expect(
      calcularScoreConciliacao(
        transacao(),
        titulo({ status: "aberto", data_baixa: null }),
      ),
    ).toBe(0);
  });

  it("considera valor absoluto do título (despesa cadastrada como negativa)", () => {
    const s = calcularScoreConciliacao(transacao(), titulo({ valor: -1000 }));
    expect(s).toBeGreaterThan(0);
  });

  it("retorna 0 quando datas estão a mais de 3 dias", () => {
    expect(
      calcularScoreConciliacao(
        transacao({ data: "2026-01-20" }),
        titulo({ data_baixa: "2026-01-10" }),
      ),
    ).toBe(0);
  });

  it("decresce o score conforme a diferença de dias aumenta", () => {
    const s0 = calcularScoreConciliacao(transacao(), titulo());
    const s3 = calcularScoreConciliacao(
      transacao({ data: "2026-01-13" }),
      titulo({ data_baixa: "2026-01-10" }),
    );
    expect(s0).toBeGreaterThan(s3);
  });

  it("usa data_vencimento como fallback quando não há data_baixa", () => {
    const s = calcularScoreConciliacao(
      transacao({ data: "2026-01-10" }),
      titulo({
        status: "baixado",
        data_baixa: null,
        data_vencimento: "2026-01-10",
      }),
    );
    expect(s).toBeGreaterThan(0);
  });
});

describe("sugerirConciliacao", () => {
  it("escolhe o título com maior score entre candidatos", () => {
    const t1 = titulo({ id: "ruim", descricao: "outra coisa qualquer" });
    const t2 = titulo({ id: "bom" });
    const sug = sugerirConciliacao(transacao(), [t1, t2]);
    expect(sug?.titulo.id).toBe("bom");
  });

  it("retorna null quando nenhum candidato atinge o threshold mínimo", () => {
    const t = titulo({ valor: 9999 });
    expect(sugerirConciliacao(transacao(), [t])).toBeNull();
  });

  it("classifica confiança como 'alta' quando score >= 0.7", () => {
    const sug = sugerirConciliacao(transacao(), [titulo()]);
    expect(sug?.confidence).toBe("alta");
  });
});