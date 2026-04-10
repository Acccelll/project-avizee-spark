import { describe, it, expect } from "vitest";
import {
  validarChaveAcesso,
  extrairInformacoesChave,
} from "@/services/fiscal/validadores/chaveAcesso.validator";

/**
 * Chave de acesso válida construída para testes:
 * cUF=35(SP) | AAMM=2204 | CNPJ=12345678000195 | mod=55 | serie=001 |
 * nNF=000000001 | tpEmis=1 | cNF=12345678 | cDV=6
 */
const CHAVE_VALIDA = "35220412345678000195550010000000011123456786";

describe("validarChaveAcesso", () => {
  it("aceita chave de acesso válida (44 dígitos, dígito verificador correto)", () => {
    expect(validarChaveAcesso(CHAVE_VALIDA)).toBe(true);
  });

  it("rejeita chave com comprimento incorreto (43 dígitos)", () => {
    expect(validarChaveAcesso(CHAVE_VALIDA.slice(0, 43))).toBe(false);
  });

  it("rejeita chave com comprimento incorreto (45 dígitos)", () => {
    expect(validarChaveAcesso(CHAVE_VALIDA + "0")).toBe(false);
  });

  it("rejeita chave com dígito verificador errado", () => {
    const chaveErrada = CHAVE_VALIDA.slice(0, 43) + "9";
    expect(validarChaveAcesso(chaveErrada)).toBe(false);
  });

  it("rejeita string vazia", () => {
    expect(validarChaveAcesso("")).toBe(false);
  });

  it("trata chave com formatação (espaços/hifens) corretamente", () => {
    // Remove não-dígitos antes de validar
    const comFormatacao = CHAVE_VALIDA.slice(0, 4) + " " + CHAVE_VALIDA.slice(4);
    // A função deve lidar ou rejeitar — verificamos apenas que não lança erro
    expect(() => validarChaveAcesso(comFormatacao)).not.toThrow();
  });
});

describe("extrairInformacoesChave", () => {
  it("extrai UF corretamente", () => {
    const info = extrairInformacoesChave(CHAVE_VALIDA);
    expect(info.uf).toBe("SP");
  });

  it("extrai ano/mês corretamente", () => {
    const info = extrairInformacoesChave(CHAVE_VALIDA);
    expect(info.anoMes).toBe("2204");
  });

  it("extrai CNPJ corretamente", () => {
    const info = extrairInformacoesChave(CHAVE_VALIDA);
    expect(info.cnpj).toBe("12345678000195");
  });

  it("extrai modelo do documento corretamente", () => {
    const info = extrairInformacoesChave(CHAVE_VALIDA);
    expect(info.modelo).toBe("55");
  });

  it("extrai série corretamente", () => {
    const info = extrairInformacoesChave(CHAVE_VALIDA);
    expect(info.serie).toBe("001");
  });

  it("extrai número corretamente", () => {
    const info = extrairInformacoesChave(CHAVE_VALIDA);
    expect(info.numero).toBe("000000001");
  });

  it("lança erro para chave com comprimento inválido", () => {
    expect(() => extrairInformacoesChave("123")).toThrow("44 dígitos");
  });
});
