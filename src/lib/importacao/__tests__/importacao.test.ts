import { describe, it, expect } from 'vitest';
import * as normalizers from '../normalizers';
import * as parsers from '../parsers';
import * as validators from '../validators';
import { FIELD_ALIASES } from '../aliases';

describe('Import Normalizers', () => {
  it('should normalize text correctly', () => {
    expect(normalizers.normalizeText('  texto  ')).toBe('texto');
    expect(normalizers.normalizeText(null)).toBe('');
    expect(normalizers.normalizeText(123)).toBe('123');
  });

  it('should normalize product codes', () => {
    expect(normalizers.normalizeCodigoProduto(' sku 123 ')).toBe('SKU-123');
    expect(normalizers.normalizeCodigoProduto('abc de')).toBe('ABC-DE');
  });

  it('should normalize CPF/CNPJ', () => {
    expect(normalizers.normalizeCpfCnpj('123.456.789-00')).toBe('12345678900');
    expect(normalizers.normalizeCpfCnpj('12.345.678/0001-99')).toBe('12345678000199');
  });

  it('should normalize money BR', () => {
    expect(normalizers.normalizeMoneyBR('R$ 1.250,50')).toBe(1250.5);
    expect(normalizers.normalizeMoneyBR('100,00')).toBe(100);
    expect(normalizers.normalizeMoneyBR(50.5)).toBe(50.5);
  });

  it('should normalize date BR', () => {
    expect(normalizers.normalizeDateBR('31/03/2024')).toBe('2024-03-31');
    expect(normalizers.normalizeDateBR('01-01-24')).toBe('2024-01-01');
  });

  it('should normalize boolean-like values', () => {
    expect(normalizers.normalizeBooleanLike('S')).toBe(true);
    expect(normalizers.normalizeBooleanLike('SIM')).toBe(true);
    expect(normalizers.normalizeBooleanLike('N')).toBe(false);
    expect(normalizers.normalizeBooleanLike('ATIVO')).toBe(true);
    expect(normalizers.normalizeBooleanLike(1)).toBe(true);
  });

  it('should normalize units of measure', () => {
    expect(normalizers.normalizeUnidadeMedida('unidade')).toBe('UN');
    expect(normalizers.normalizeUnidadeMedida('peça')).toBe('PC');
    expect(normalizers.normalizeUnidadeMedida('KILO')).toBe('KG');
    expect(normalizers.normalizeUnidadeMedida('UNKNOWN')).toBe('UNKNOWN');
  });
});

describe('Import Parsers', () => {
  it('should parse flexible decimals', () => {
    expect(parsers.parseDecimalFlexible('1.250,50').value).toBe(1250.5);
    expect(parsers.parseDecimalFlexible('10.5').value).toBe(10.5);
    expect(parsers.parseDecimalFlexible('abc').value).toBeNull();
  });

  it('should parse flexible dates including excel serials', () => {
    expect(parsers.parseDateFlexible('31/03/2024').value).toBe('2024-03-31');
    expect(parsers.parseDateFlexible('2024-03-31').value).toBe('2024-03-31');
    // Excel serial 45382 is 2024-03-31 (using 30/12/1899 as base)
    expect(parsers.parseDateFlexible('45382').value).toBe('2024-03-31');
  });

  it('should parse stock quantities with expressions and mixed units', () => {
    expect(parsers.parseQuantidadeEstoque('12').value).toBe(12);
    expect(parsers.parseQuantidadeEstoque('12,5').value).toBe(12.5);
    expect(parsers.parseQuantidadeEstoque('=10+5').value).toBe(15);
    expect(parsers.parseQuantidadeEstoque('=41+(8/12)').value).toBeCloseTo(41.666, 2);
    expect(parsers.parseQuantidadeEstoque('2DZ e 5un').value).toBe(29); // 2*12 + 5
    expect(parsers.parseQuantidadeEstoque('1CX').value).toBe(6); // CX defaults to 6
  });
});

describe('Import Validators', () => {
  it('should validate product import', () => {
    const validProduct = {
      codigo: 'P001',
      nome: 'Produto Teste',
      preco_venda: '150,00'
    };
    const result = validators.validateProdutoImport(validProduct);
    expect(result.valid).toBe(true);
    expect(result.normalizedData.codigo_interno).toBe('P001');
    expect(result.normalizedData.preco_venda).toBe(150);

    const invalidProduct = {
      nome: 'Sem Codigo'
    };
    const result2 = validators.validateProdutoImport(invalidProduct);
    expect(result2.valid).toBe(false);
    expect(result2.errors).toContain('Código do produto é obrigatório.');
  });

  it('should validate client import', () => {
    const validClient = {
      nome: 'Fulano de Tal',
      CPF: '12345678901'
    };
    const result = validators.validateClienteImport(validClient);
    expect(result.valid).toBe(true);
    expect(result.normalizedData.cpf_cnpj).toBe('12345678901');

    const invalidClient = {
      nome: 'Ciclano',
      CPF: '123'
    };
    const result2 = validators.validateClienteImport(invalidClient);
    expect(result2.valid).toBe(false);
    expect(result2.errors).toContain('CPF/CNPJ inválido (deve ter 11 ou 14 dígitos).');
  });

  it('should validate stock import', () => {
    const validStock = {
      SKU: 'PROD-01',
      QTD: '10DZ'
    };
    const result = validators.validateEstoqueInicialImport(validStock);
    expect(result.valid).toBe(true);
    expect(result.normalizedData.quantidade).toBe(120);
  });

  it('should auto-map headers based on aliases', () => {
    const headers = ['SKU', 'PREÇO', 'NOME FANTASIA', 'DESCONHECIDO'];
    const mapping: Record<string, string> = {};

    headers.forEach(h => {
      const cleanH = String(h).trim().toUpperCase();
      if (FIELD_ALIASES[cleanH]) {
        mapping[FIELD_ALIASES[cleanH]] = h;
      }
    });

    expect(mapping['codigo_interno']).toBe('SKU');
    expect(mapping['preco_venda']).toBe('PREÇO');
    expect(mapping['nome_fantasia']).toBe('NOME FANTASIA');
    expect(mapping['desconhecido']).toBeUndefined();
  });
});
