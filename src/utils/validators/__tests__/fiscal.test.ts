import { describe, expect, it } from "vitest";

import { isCESTRequiredForNCM, validateCEST, validateNCM } from "@/utils/validators/fiscal";

describe("validators/fiscal", () => {
  describe("validateNCM", () => {
    it("aceita NCM válido com 8 dígitos", () => {
      expect(validateNCM("01012100")).toBe(true);
      expect(validateNCM("0101.21.00")).toBe(true);
    });

    it("rejeita NCM inválido", () => {
      expect(validateNCM("0101A100")).toBe(false);
      expect(validateNCM("1234567")).toBe(false);
      expect(validateNCM("123456789")).toBe(false);
    });
  });

  describe("validateCEST", () => {
    it("aceita CEST válido com 7 dígitos", () => {
      expect(validateCEST("1234567")).toBe(true);
      expect(validateCEST("12.345.67")).toBe(true);
    });

    it("rejeita CEST inválido", () => {
      expect(validateCEST("123456")).toBe(false);
      expect(validateCEST("12345A7")).toBe(false);
    });
  });

  describe("isCESTRequiredForNCM", () => {
    it("retorna false para NCM de serviço/agro sem obrigatoriedade de CEST", () => {
      expect(isCESTRequiredForNCM("0101.21.00")).toBe(false);
    });

    it("retorna true para NCM válido fora da exceção", () => {
      expect(isCESTRequiredForNCM("22030000")).toBe(true);
    });

    it("retorna false quando NCM é inválido", () => {
      expect(isCESTRequiredForNCM("ABC")).toBe(false);
    });
  });
});
