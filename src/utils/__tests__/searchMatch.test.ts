import { describe, expect, it } from "vitest";
import { buildNomeDocumentoOrFilter, matchesSearch } from "../searchMatch";

describe("matchesSearch", () => {
  const cliente = ["ACME INDUSTRIA LTDA", "Acme", "12345678000199"];

  it("acha o CNPJ digitado com ou sem pontuação", () => {
    expect(matchesSearch(cliente, "12.345.678/0001-99")).toBe(true);
    expect(matchesSearch(cliente, "12345678000199")).toBe(true);
    expect(matchesSearch(cliente, "12.345.678")).toBe(true);
    expect(matchesSearch(cliente, " 12345678 ")).toBe(true);
  });

  it("acha CNPJ gravado com máscara a partir dos dígitos", () => {
    expect(matchesSearch(["12.345.678/0001-99"], "1234567800")).toBe(true);
  });

  it("continua buscando por nome, sem diferenciar maiúsculas", () => {
    expect(matchesSearch(cliente, "industria")).toBe(true);
    expect(matchesSearch(cliente, "outra empresa")).toBe(false);
  });

  it("não casa números soltos em nomes pela comparação só de dígitos", () => {
    expect(matchesSearch(["Agulha 25x7"], "25.7")).toBe(false);
    expect(matchesSearch(["Agulha 25x7"], "25x7")).toBe(true);
  });

  it("termo vazio casa tudo e campos vazios são ignorados", () => {
    expect(matchesSearch(cliente, "  ")).toBe(true);
    expect(matchesSearch([null, undefined, ""], "123")).toBe(false);
  });
});

describe("buildNomeDocumentoOrFilter", () => {
  it("gera variantes do documento com e sem máscara", () => {
    const f = buildNomeDocumentoOrFilter("12.345.678/0001-99", ["nome_razao_social"]);
    expect(f).toContain("nome_razao_social.ilike.%12.345.678/0001-99%");
    expect(f).toContain("cpf_cnpj.ilike.%12345678000199%");
    expect(f).toContain("cpf_cnpj.ilike.%12.345.678/0001-99%");
  });

  it("descarta vírgulas e parênteses, que quebram o .or do PostgREST", () => {
    const f = buildNomeDocumentoOrFilter("ACME (filial), SP", ["nome_razao_social"]);
    expect(f).not.toMatch(/[()]/);
    expect(f.split(",").every((p) => p.includes(".ilike."))).toBe(true);
  });

  it("termo vazio não gera filtro", () => {
    expect(buildNomeDocumentoOrFilter("  ", ["nome_razao_social"])).toBe("");
  });
});
