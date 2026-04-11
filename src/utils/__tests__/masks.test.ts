import { describe, it, expect } from "vitest";
import { cpfMask, cnpjMask, cpfCnpjMask, phoneMask, cepMask } from "../masks";

describe("cpfMask", () => {
  it("formats a full CPF number", () => {
    expect(cpfMask("12345678901")).toBe("123.456.789-01");
  });

  it("formats partial CPF input", () => {
    expect(cpfMask("123")).toBe("123");
    expect(cpfMask("1234567")).toBe("123.456.7");
    expect(cpfMask("123456789")).toBe("123.456.789");
    expect(cpfMask("12345678901")).toBe("123.456.789-01");
  });

  it("strips non-digit characters before masking", () => {
    expect(cpfMask("123.456.789-01")).toBe("123.456.789-01");
    expect(cpfMask("  123 456 789 01  ")).toBe("123.456.789-01");
  });

  it("truncates input longer than 11 digits", () => {
    expect(cpfMask("123456789012345")).toBe("123.456.789-01");
  });

  it("returns empty string for empty input", () => {
    expect(cpfMask("")).toBe("");
  });
});

describe("cnpjMask", () => {
  it("formats a full CNPJ number", () => {
    expect(cnpjMask("12345678000195")).toBe("12.345.678/0001-95");
  });

  it("formats partial CNPJ input", () => {
    expect(cnpjMask("12")).toBe("12");
    expect(cnpjMask("12345")).toBe("12.345");
    expect(cnpjMask("12345678")).toBe("12.345.678");
    expect(cnpjMask("123456780001")).toBe("12.345.678/0001");
  });

  it("strips non-digit characters before masking", () => {
    expect(cnpjMask("12.345.678/0001-95")).toBe("12.345.678/0001-95");
  });

  it("truncates input longer than 14 digits", () => {
    expect(cnpjMask("1234567800019599")).toBe("12.345.678/0001-95");
  });

  it("returns empty string for empty input", () => {
    expect(cnpjMask("")).toBe("");
  });
});

describe("cpfCnpjMask", () => {
  it("applies CPF mask for 11-digit input", () => {
    expect(cpfCnpjMask("12345678901")).toBe("123.456.789-01");
  });

  it("applies CNPJ mask for 14-digit input", () => {
    expect(cpfCnpjMask("12345678000195")).toBe("12.345.678/0001-95");
  });

  it("applies CPF mask while typing up to 11 digits", () => {
    expect(cpfCnpjMask("1234567890")).toBe("123.456.789-0");
  });

  it("switches to CNPJ mask for 12+ digit input", () => {
    const result = cpfCnpjMask("123456789012");
    expect(result.replace(/\D/g, "").length).toBeGreaterThan(11);
  });
});

describe("phoneMask", () => {
  it("formats a 10-digit landline number", () => {
    expect(phoneMask("1133334444")).toBe("(11) 3333-4444");
  });

  it("formats an 11-digit mobile number", () => {
    expect(phoneMask("11999998888")).toBe("(11) 99999-8888");
  });

  it("formats partial phone input", () => {
    expect(phoneMask("11")).toBe("(11) ");
    expect(phoneMask("1133")).toBe("(11) 33");
  });

  it("strips non-digit characters before masking", () => {
    expect(phoneMask("(11) 3333-4444")).toBe("(11) 3333-4444");
    expect(phoneMask("(11) 99999-8888")).toBe("(11) 99999-8888");
  });

  it("returns empty string for empty input", () => {
    expect(phoneMask("")).toBe("");
  });
});

describe("cepMask", () => {
  it("formats a full CEP", () => {
    expect(cepMask("01310100")).toBe("01310-100");
  });

  it("formats partial CEP input", () => {
    expect(cepMask("01310")).toBe("01310");
    expect(cepMask("013101")).toBe("01310-1");
  });

  it("strips non-digit characters before masking", () => {
    expect(cepMask("01310-100")).toBe("01310-100");
  });

  it("truncates input longer than 8 digits", () => {
    expect(cepMask("013101009999")).toBe("01310-100");
  });

  it("returns empty string for empty input", () => {
    expect(cepMask("")).toBe("");
  });
});
