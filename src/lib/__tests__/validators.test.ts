import { describe, it, expect } from "vitest";
import { validateCPF, validateCNPJ, validateCpfCnpj } from "../validators";

describe("validateCPF", () => {
  it("accepts valid CPFs", () => {
    expect(validateCPF("529.982.247-25")).toBe(true);
    expect(validateCPF("52998224725")).toBe(true);
  });

  it("rejects invalid CPFs", () => {
    expect(validateCPF("111.111.111-11")).toBe(false);
    expect(validateCPF("123.456.789-00")).toBe(false);
    expect(validateCPF("123")).toBe(false);
    expect(validateCPF("")).toBe(false);
  });
});

describe("validateCNPJ", () => {
  it("accepts valid CNPJs", () => {
    expect(validateCNPJ("11.222.333/0001-81")).toBe(true);
    expect(validateCNPJ("11222333000181")).toBe(true);
  });

  it("rejects invalid CNPJs", () => {
    expect(validateCNPJ("11.111.111/1111-11")).toBe(false);
    expect(validateCNPJ("12.345.678/0001-00")).toBe(false);
    expect(validateCNPJ("123")).toBe(false);
    expect(validateCNPJ("")).toBe(false);
  });
});

describe("validateCpfCnpj", () => {
  it("detects CPF type for 11 digit input", () => {
    const result = validateCpfCnpj("529.982.247-25");
    expect(result.type).toBe("cpf");
    expect(result.valid).toBe(true);
  });

  it("detects CNPJ type for 14 digit input", () => {
    const result = validateCpfCnpj("11.222.333/0001-81");
    expect(result.type).toBe("cnpj");
    expect(result.valid).toBe(true);
  });

  it("returns invalid for bad input", () => {
    const result = validateCpfCnpj("000.000.000-00");
    expect(result.valid).toBe(false);
  });
});
