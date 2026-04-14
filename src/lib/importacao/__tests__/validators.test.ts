import { describe, it, expect } from "vitest";
import {
  validateProdutoImport,
  validateClienteImport,
  validateFornecedorImport,
  validateEstoqueInicialImport,
  validateFinanceiroImport,
  validateFaturamentoImport,
} from "../validators";

describe("validateProdutoImport", () => {
  it("validates a complete product row", () => {
    const result = validateProdutoImport({
      codigo_interno: "SKU001",
      nome: "Produto Teste",
      preco_venda: "10.50",
      unidade_medida: "UN",
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.normalizedData.codigo_interno).toBe("SKU001");
    expect(result.normalizedData.preco_venda).toBe(10.5);
    expect(result.normalizedData.tipo_item).toBe("produto");
  });

  it("rejects product without code", () => {
    const result = validateProdutoImport({ nome: "Sem Código" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Código do produto é obrigatório.");
  });

  it("rejects product without name", () => {
    const result = validateProdutoImport({ codigo_interno: "SKU001" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Nome/Descrição do produto é obrigatório.");
  });

  it("recognizes insumo type", () => {
    const result = validateProdutoImport({
      codigo_interno: "INS001",
      nome: "Insumo Teste",
      tipo_item: "insumo",
    });
    expect(result.normalizedData.tipo_item).toBe("insumo");
  });

  it("warns on zero price for produto", () => {
    const result = validateProdutoImport({
      codigo_interno: "SKU002",
      nome: "Produto Sem Preço",
    });
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain("Preço de venda é zero ou não informado.");
  });

  it("accepts codigo_legado as primary key", () => {
    const result = validateProdutoImport({
      codigo_legado: "LEG001",
      nome: "Produto Legado",
    });
    expect(result.valid).toBe(true);
    expect(result.normalizedData.codigo_legado).toBe("LEG001");
  });
});

describe("validateClienteImport", () => {
  it("validates a complete client", () => {
    const result = validateClienteImport({
      nome: "Empresa ABC",
      cpf_cnpj: "12.345.678/0001-90",
    });
    expect(result.valid).toBe(true);
    expect(result.normalizedData.cpf_cnpj).toBe("12345678000190");
    expect(result.normalizedData.tipo_pessoa).toBe("J");
  });

  it("rejects client without name", () => {
    const result = validateClienteImport({ cpf_cnpj: "12345678901" });
    expect(result.valid).toBe(false);
  });

  it("warns when no key is available", () => {
    const result = validateClienteImport({ nome: "Sem Chave" });
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain("Sem chave legada nem CPF/CNPJ: risco de duplicidade.");
  });

  it("rejects invalid CPF/CNPJ length", () => {
    const result = validateClienteImport({ nome: "Teste", cpf_cnpj: "123" });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("CPF/CNPJ inválido");
  });
});

describe("validateFornecedorImport", () => {
  it("validates a complete supplier", () => {
    const result = validateFornecedorImport({
      nome: "Fornecedor XYZ",
      cpf_cnpj: "98765432000100",
    });
    expect(result.valid).toBe(true);
    expect(result.normalizedData.tipo_pessoa).toBe("J");
  });
});

describe("validateEstoqueInicialImport", () => {
  it("validates a complete stock row", () => {
    const result = validateEstoqueInicialImport({
      codigo_produto: "SKU001",
      quantidade: "100",
      custo_unitario: "5.50",
    });
    expect(result.valid).toBe(true);
    expect(result.normalizedData.quantidade).toBe(100);
    expect(result.normalizedData.custo_unitario).toBe(5.5);
  });

  it("rejects negative quantity", () => {
    const result = validateEstoqueInicialImport({
      codigo_produto: "SKU001",
      quantidade: "-5",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Quantidade não pode ser negativa.");
  });

  it("rejects missing product code", () => {
    const result = validateEstoqueInicialImport({ quantidade: "10" });
    expect(result.valid).toBe(false);
  });
});

describe("validateFinanceiroImport", () => {
  it("validates a receivable", () => {
    const result = validateFinanceiroImport({
      tipo: "CR",
      descricao: "Fatura 001",
      data_vencimento: "2026-03-15",
      valor: "1500.00",
      cpf_cnpj: "12345678000190",
    });
    expect(result.valid).toBe(true);
    expect(result.normalizedData.tipo).toBe("receber");
    expect(result.normalizedData.valor).toBe(1500);
  });

  it("validates a payable", () => {
    const result = validateFinanceiroImport({
      tipo: "CP",
      descricao: "Conta de luz",
      data_vencimento: "2026-04-10",
      valor: "350",
    });
    expect(result.valid).toBe(true);
    expect(result.normalizedData.tipo).toBe("pagar");
  });

  it("rejects missing value", () => {
    const result = validateFinanceiroImport({
      tipo: "CR",
      descricao: "Teste",
      data_vencimento: "2026-01-01",
      valor: "0",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Valor deve ser maior que zero.");
  });

  it("detects paid status from data_pagamento", () => {
    const result = validateFinanceiroImport({
      tipo: "CP",
      descricao: "Pago",
      data_vencimento: "2026-01-01",
      valor: "100",
      data_pagamento: "2026-01-05",
    });
    expect(result.normalizedData.status).toBe("baixado");
  });
});

describe("validateFaturamentoImport", () => {
  it("validates a NF line", () => {
    const result = validateFaturamentoImport({
      numero_nota: "12345",
      data: "2026-01-15",
      cliente: "Cliente ABC",
      codigo_produto_nf: "SKU001",
      quantidade_nf: "10",
      valor_unitario: "25.00",
    });
    expect(result.valid).toBe(true);
    expect(result.normalizedData.numero_nota).toBe("12345");
    expect(result.normalizedData.valor_total).toBe(250);
  });

  it("rejects missing NF number", () => {
    const result = validateFaturamentoImport({
      data: "2026-01-01",
      valor_total: "100",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Número da nota fiscal é obrigatório.");
  });
});
