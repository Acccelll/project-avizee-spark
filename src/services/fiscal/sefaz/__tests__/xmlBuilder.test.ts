import { describe, it, expect } from "vitest";
import {
  construirXMLNFe,
  construirXMLCancelamento,
  construirXMLInutilizacao,
} from "@/services/fiscal/sefaz/xmlBuilder.service";
import type { NFeData } from "@/services/fiscal/sefaz/xmlBuilder.service";

const DADOS_NFE_MINIMOS: NFeData = {
  chave: "35220412345678000195550010000000011123456786",
  numero: "1",
  serie: "001",
  dataEmissao: "2022-04-15T10:00:00-03:00",
  naturezaOperacao: "Venda de mercadoria",
  tipoDocumento: "1",
  finalidade: "1",
  emitente: {
    cnpj: "12345678000195",
    razaoSocial: "Empresa Teste LTDA",
    ie: "111111111119",
    uf: "35",
    cep: "01310100",
    logradouro: "Av. Paulista",
    numero: "1000",
    municipio: "São Paulo",
    codigoMunicipio: "3550308",
  },
  crt: "1",
  ambiente: "2",
  destinatario: {
    cpfCnpj: "98765432000111",
    razaoSocial: "Cliente Teste SA",
    indIEDest: "9",
    uf: "SP",
    cep: "20040030",
    logradouro: "Rua do Comércio",
    numero: "100",
    municipio: "Rio de Janeiro",
    codigoMunicipio: "3304557",
  },
  itens: [
    {
      numero: 1,
      codigo: "PROD001",
      descricao: "Produto de Teste",
      ncm: "87032110",
      cfop: "5102",
      unidade: "UN",
      quantidade: 2,
      valorUnitario: 150.0,
      valorTotal: 300.0,
      icms: { cst: "00", modalidade: "3", aliquota: 12, valor: 36.0, base: 300.0 },
      pis: { cst: "01", aliquota: 0.65, valor: 1.95 },
      cofins: { cst: "01", aliquota: 3, valor: 9.0 },
    },
  ],
  totais: {
    baseIcms: 300.0,
    valorIcms: 36.0,
    valorIcmsSt: 0,
    valorProdutos: 300.0,
    valorFrete: 0,
    valorSeguro: 0,
    valorDesconto: 0,
    valorIpi: 0,
    valorPis: 1.95,
    valorCofins: 9.0,
    outrasDespesas: 0,
    valorNF: 300.0,
  },
  pagamentos: [{ forma: "01", valor: 300.0 }],
  cfop: "5102",
};

describe("construirXMLNFe", () => {
  it("retorna uma string não vazia", () => {
    const xml = construirXMLNFe(DADOS_NFE_MINIMOS);
    expect(typeof xml).toBe("string");
    expect(xml.length).toBeGreaterThan(0);
  });

  it("contém a tag raiz nfeProc", () => {
    const xml = construirXMLNFe(DADOS_NFE_MINIMOS);
    expect(xml).toContain("<nfeProc");
  });

  it("contém o CNPJ do emitente", () => {
    const xml = construirXMLNFe(DADOS_NFE_MINIMOS);
    expect(xml).toContain("12345678000195");
  });

  it("contém o CNPJ do destinatário", () => {
    const xml = construirXMLNFe(DADOS_NFE_MINIMOS);
    expect(xml).toContain("98765432000111");
  });

  it("contém o NCM do item", () => {
    const xml = construirXMLNFe(DADOS_NFE_MINIMOS);
    expect(xml).toContain("87032110");
  });

  it("contém o valor total da NF-e", () => {
    const xml = construirXMLNFe(DADOS_NFE_MINIMOS);
    expect(xml).toContain("<vNF>300.00</vNF>");
  });

  it("contém tag ICMS", () => {
    const xml = construirXMLNFe(DADOS_NFE_MINIMOS);
    expect(xml).toContain("<ICMS>");
  });

  it("contém tag PIS", () => {
    const xml = construirXMLNFe(DADOS_NFE_MINIMOS);
    expect(xml).toContain("<PIS>");
  });

  it("contém tag COFINS", () => {
    const xml = construirXMLNFe(DADOS_NFE_MINIMOS);
    expect(xml).toContain("<COFINS>");
  });

  it("contém a natureza da operação", () => {
    const xml = construirXMLNFe(DADOS_NFE_MINIMOS);
    expect(xml).toContain("Venda de mercadoria");
  });
});

describe("construirXMLCancelamento", () => {
  it("contém o protocolo informado", () => {
    const xml = construirXMLCancelamento(
      "35220412345678000195550010000000011123456786",
      "135220012345678",
      "Cancelamento solicitado pelo cliente",
      "12345678000195",
      "2022-04-15T10:00:00-03:00",
    );
    expect(xml).toContain("135220012345678");
  });

  it("contém a justificativa", () => {
    const xml = construirXMLCancelamento(
      "35220412345678000195550010000000011123456786",
      "135220012345678",
      "Cancelamento solicitado pelo cliente",
      "12345678000195",
      "2022-04-15T10:00:00-03:00",
    );
    expect(xml).toContain("Cancelamento solicitado pelo cliente");
  });

  it("contém a tag envEvento", () => {
    const xml = construirXMLCancelamento(
      "35220412345678000195550010000000011123456786",
      "135220012345678",
      "Cancelamento solicitado",
      "12345678000195",
      "2022-04-15T10:00:00-03:00",
    );
    expect(xml).toContain("<envEvento");
  });
});

describe("construirXMLInutilizacao", () => {
  it("contém o CNPJ", () => {
    const xml = construirXMLInutilizacao("12345678000195", 2022, 1, 1, 10, "Numeração inutilizada", "35");
    expect(xml).toContain("12345678000195");
  });

  it("contém a justificativa", () => {
    const xml = construirXMLInutilizacao("12345678000195", 2022, 1, 1, 10, "Numeração inutilizada", "35");
    expect(xml).toContain("Numeração inutilizada");
  });

  it("contém a tag inutNFe", () => {
    const xml = construirXMLInutilizacao("12345678000195", 2022, 1, 1, 10, "Numeração inutilizada", "35");
    expect(xml).toContain("<inutNFe");
  });
});
