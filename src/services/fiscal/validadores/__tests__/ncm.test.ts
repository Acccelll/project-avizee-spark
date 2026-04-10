import { describe, it, expect } from "vitest";
import { validarNCM, buscarDescricaoNCM } from "@/services/fiscal/validadores/ncm.validator";

describe("validarNCM", () => {
  it("aceita NCM válido de 8 dígitos", () => {
    expect(validarNCM("01012100")).toBe(true);
  });

  it("aceita outro NCM de 8 dígitos", () => {
    expect(validarNCM("87032110")).toBe(true);
  });

  it("rejeita NCM com 7 dígitos", () => {
    expect(validarNCM("0101210")).toBe(false);
  });

  it("rejeita NCM com 9 dígitos", () => {
    expect(validarNCM("010121000")).toBe(false);
  });

  it("rejeita NCM com caracteres não numéricos", () => {
    expect(validarNCM("0101A100")).toBe(false);
    expect(validarNCM("01.012100")).toBe(false);
  });

  it("rejeita string vazia", () => {
    expect(validarNCM("")).toBe(false);
  });

  it("rejeita NCM com espaços (não-numéricos)", () => {
    expect(validarNCM("0101 100")).toBe(false);
  });
});

describe("buscarDescricaoNCM", () => {
  it("retorna descrição para NCM conhecido", async () => {
    const desc = await buscarDescricaoNCM("01012100");
    expect(desc).not.toBe("NCM inválido");
    expect(desc).not.toBe("NCM não encontrado");
    expect(typeof desc).toBe("string");
  });

  it("retorna 'NCM não encontrado' para NCM desconhecido", async () => {
    const desc = await buscarDescricaoNCM("99999999");
    expect(desc).toBe("NCM não encontrado");
  });

  it("retorna 'NCM inválido' para NCM inválido", async () => {
    const desc = await buscarDescricaoNCM("abc");
    expect(desc).toBe("NCM inválido");
  });
});
