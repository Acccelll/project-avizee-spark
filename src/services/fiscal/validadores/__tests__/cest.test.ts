import { describe, it, expect } from "vitest";
import { validarCEST, isCESTObrigatorio } from "@/services/fiscal/validadores/cest.validator";

describe("validarCEST", () => {
  it("aceita CEST válido de 7 dígitos", () => {
    expect(validarCEST("0100100")).toBe(true);
  });

  it("aceita outro CEST de 7 dígitos", () => {
    expect(validarCEST("1010100")).toBe(true);
  });

  it("rejeita CEST com 6 dígitos", () => {
    expect(validarCEST("100100")).toBe(false);
  });

  it("rejeita CEST com 8 dígitos", () => {
    expect(validarCEST("01001000")).toBe(false);
  });

  it("rejeita CEST com letras", () => {
    expect(validarCEST("010A100")).toBe(false);
  });

  it("rejeita string vazia", () => {
    expect(validarCEST("")).toBe(false);
  });
});

describe("isCESTObrigatorio", () => {
  it("retorna true para NCM com substituição tributária obrigatória", () => {
    // 22021000 (refrigerante) está na lista
    expect(isCESTObrigatorio("22021000")).toBe(true);
  });

  it("retorna true para NCM de pneumáticos", () => {
    expect(isCESTObrigatorio("40111000")).toBe(true);
  });

  it("retorna false para NCM sem substituição tributária", () => {
    expect(isCESTObrigatorio("01012100")).toBe(false);
  });

  it("retorna false para NCM aleatório não na lista", () => {
    expect(isCESTObrigatorio("99999999")).toBe(false);
  });
});
