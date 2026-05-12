import { describe, it, expect } from "vitest";
import {
  normalizeText,
  normalizeCodigoProduto,
  normalizeCpfCnpj,
  normalizeEmail,
  normalizePhone,
  normalizeCep,
  normalizeMoneyBR,
  normalizeDateBR,
  normalizeBooleanLike,
  normalizeUnidadeMedida,
  normalizeStatusImportacao,
} from "../normalizers";

describe("normalizeText", () => {
  it("retorna string vazia para null/undefined", () => {
    expect(normalizeText(null)).toBe("");
    expect(normalizeText(undefined)).toBe("");
  });
  it("trima whitespace", () => {
    expect(normalizeText("  abc  ")).toBe("abc");
  });
});

describe("normalizeCodigoProduto", () => {
  it("uppercase + trim + colapsa espaços com hífen", () => {
    expect(normalizeCodigoProduto("  abc 123 ")).toBe("ABC-123");
  });
  it("vazio para falsy", () => {
    expect(normalizeCodigoProduto("")).toBe("");
    expect(normalizeCodigoProduto(null)).toBe("");
  });
});

describe("normalizeCpfCnpj", () => {
  it("mantém apenas dígitos", () => {
    expect(normalizeCpfCnpj("123.456.789-00")).toBe("12345678900");
    expect(normalizeCpfCnpj("12.345.678/0001-90")).toBe("12345678000190");
  });
});

describe("normalizeEmail", () => {
  it("lowercase + trim", () => {
    expect(normalizeEmail("  Foo@Bar.COM ")).toBe("foo@bar.com");
  });
});

describe("normalizePhone", () => {
  it("remove tudo que não for dígito", () => {
    expect(normalizePhone("(11) 98765-4321")).toBe("11987654321");
  });
});

describe("normalizeCep", () => {
  it("padroniza para 8 dígitos com leading zero", () => {
    expect(normalizeCep("01310-100")).toBe("01310100");
    expect(normalizeCep("1310100")).toBe("01310100");
  });
  it("trunca para 8 dígitos", () => {
    expect(normalizeCep("123456789")).toBe("12345678");
  });
});

describe("normalizeMoneyBR", () => {
  it("converte formato BR para number", () => {
    expect(normalizeMoneyBR("R$ 1.250,50")).toBe(1250.5);
    expect(normalizeMoneyBR("1.000.000,00")).toBe(1000000);
    expect(normalizeMoneyBR("0,99")).toBe(0.99);
  });
  it("aceita number direto", () => {
    expect(normalizeMoneyBR(42.5)).toBe(42.5);
  });
  it("retorna 0 para vazio/inválido", () => {
    expect(normalizeMoneyBR("")).toBe(0);
    expect(normalizeMoneyBR(null)).toBe(0);
    expect(normalizeMoneyBR("abc")).toBe(0);
  });
});

describe("normalizeDateBR", () => {
  it("dd/mm/aaaa → ISO yyyy-mm-dd", () => {
    expect(normalizeDateBR("25/12/2024")).toBe("2024-12-25");
  });
  it("aceita ano com 2 dígitos (assume 20xx)", () => {
    expect(normalizeDateBR("01/01/24")).toBe("2024-01-01");
  });
  it("aceita d/m/aa sem padding", () => {
    expect(normalizeDateBR("1/2/24")).toBe("2024-02-01");
  });
  it("retorna null para inválido", () => {
    expect(normalizeDateBR("xyz")).toBe(null);
    expect(normalizeDateBR(null)).toBe(null);
  });
});

describe("normalizeBooleanLike", () => {
  it("trata aliases positivos", () => {
    for (const v of ["S", "SIM", "true", "Verdadeiro", "ativo", "ok", 1, "1", true]) {
      expect(normalizeBooleanLike(v)).toBe(true);
    }
  });
  it("trata aliases negativos", () => {
    for (const v of ["N", "NAO", "false", 0, "0", false, null, ""]) {
      expect(normalizeBooleanLike(v)).toBe(false);
    }
  });
});

describe("normalizeUnidadeMedida", () => {
  it("default para UN quando vazio", () => {
    expect(normalizeUnidadeMedida("")).toBe("UN");
    expect(normalizeUnidadeMedida(null)).toBe("UN");
  });
  it("mantém código quando não há alias", () => {
    expect(normalizeUnidadeMedida("XYZ")).toBe("XYZ");
  });
});

describe("normalizeStatusImportacao", () => {
  it("default para pendente quando vazio ou desconhecido", () => {
    expect(normalizeStatusImportacao("")).toBe("pendente");
    expect(normalizeStatusImportacao("zzz")).toBe("pendente");
  });
});