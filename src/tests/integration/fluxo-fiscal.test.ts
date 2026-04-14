import { describe, it, expect, vi } from 'vitest';
import { construirXMLNFe } from '@/services/fiscal/sefaz/xmlBuilder.service';
import { autorizarNFe } from '@/services/fiscal/sefaz/autorizacao.service';
import type { NFeData } from '@/services/fiscal/sefaz/xmlBuilder.service';
import type { CertificadoDigital } from '@/services/fiscal/sefaz/assinaturaDigital.service';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

const mockNFeData: NFeData = {
  emitente: {
    cnpj: '11222333000181',
    razaoSocial: 'Empresa Teste Ltda',
    ie: '1234567890',
    uf: 'SP',
    cep: '01001000',
    logradouro: 'Rua Teste',
    numero: '100',
    municipio: 'São Paulo',
    codigoMunicipio: '3550308',
  },
  destinatario: {
    cpfCnpj: '44555666000199',
    razaoSocial: 'Cliente Teste SA',
    ie: '9876543210',
    uf: 'RJ',
    cep: '20040020',
    logradouro: 'Av Teste',
    numero: '200',
    municipio: 'Rio de Janeiro',
    codigoMunicipio: '3304557',
  },
  itens: [
    {
      numero: 1,
      codigo: 'PROD001',
      descricao: 'Produto Teste',
      ncm: '84719012',
      cfop: '5102',
      unidade: 'UN',
      quantidade: 10,
      valorUnitario: 100.00,
      valorTotal: 1000.00,
      icms: { cst: '00', modalidade: '3', aliquota: 18, valor: 180.00, base: 1000.00 },
      pis: { cst: '01', aliquota: 1.65, valor: 16.50 },
      cofins: { cst: '01', aliquota: 7.60, valor: 76.00 },
    },
  ],
  totais: {
    baseIcms: 1000, valorIcms: 180, valorIcmsSt: 0, valorProdutos: 1000,
    valorFrete: 0, valorSeguro: 0, valorDesconto: 0, valorIpi: 0,
    valorPis: 16.5, valorCofins: 76, outrasDespesas: 0, valorNF: 1000,
  },
  pagamentos: [{ forma: '01', valor: 1000 }],
  cfop: '5102',
  numero: '1',
  serie: '1',
  naturezaOperacao: 'Venda de mercadoria',
  dataEmissao: '2026-04-14T10:00:00-03:00',
  chave: '35260411222333000181550010000000011123456789',
  tipoDocumento: '1',
  finalidade: '1',
};

const mockCertA1: CertificadoDigital = {
  tipo: 'A1',
  conteudo: 'base64encodedcontent',
  senha: 'test123',
};

describe('Fluxo Fiscal — construção e autorização de NF-e', () => {
  it('construirXMLNFe gera XML com elementos obrigatórios', () => {
    const xml = construirXMLNFe(mockNFeData);
    expect(xml).toContain('<infNFe');
    expect(xml).toContain('<emit>');
    expect(xml).toContain('<dest>');
    expect(xml).toContain('<det nItem="1"');
    expect(xml).toContain('<prod>');
    expect(xml).toContain('<CNPJ>11222333000181</CNPJ>');
    expect(xml).toContain('<natOp>Venda de mercadoria</natOp>');
  });

  it('validação de chave de acesso (44 dígitos)', () => {
    const chave = mockNFeData.chave;
    expect(chave).toHaveLength(44);
    expect(chave).toMatch(/^\d{44}$/);
  });

  it('rejeita certificado A3', async () => {
    const certA3: CertificadoDigital = { tipo: 'A3', conteudo: '', senha: '' };
    const result = await autorizarNFe(mockNFeData, certA3, 'https://nfe.sefaz.sp.gov.br');
    expect(result.sucesso).toBe(false);
    expect(result.motivo).toContain('A3');
  });

  it('rejeita certificado sem conteúdo', async () => {
    const cert: CertificadoDigital = { tipo: 'A1', conteudo: '', senha: '' };
    const result = await autorizarNFe(mockNFeData, cert, 'https://nfe.sefaz.sp.gov.br');
    expect(result.sucesso).toBe(false);
    expect(result.motivo).toContain('obrigatórios');
  });

  it('autorização com cStat=100 retorna sucesso', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        sucesso: true,
        xmlRetorno: '<nfeProc><protNFe><infProt><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo><nProt>135260000000001</nProt></infProt></protNFe></nfeProc>',
      },
      error: null,
    });

    const result = await autorizarNFe(mockNFeData, mockCertA1, 'https://nfe.sefaz.sp.gov.br');
    expect(result.sucesso).toBe(true);
    expect(result.protocolo).toBe('135260000000001');
    expect(result.status).toBe('100');
  });

  it('rejeição com cStat=539 retorna erro', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        sucesso: true,
        xmlRetorno: '<nfeProc><protNFe><infProt><cStat>539</cStat><xMotivo>Duplicidade de NF-e</xMotivo></infProt></protNFe></nfeProc>',
      },
      error: null,
    });

    const result = await autorizarNFe(mockNFeData, mockCertA1, 'https://nfe.sefaz.sp.gov.br');
    expect(result.sucesso).toBe(false);
    expect(result.status).toBe('539');
    expect(result.motivo).toContain('Duplicidade');
  });
});
