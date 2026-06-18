import { describe, expect, it } from "vitest";
import {
  buildItensPayload,
  buildNotaFiscalRascunho,
  calcularTotaisWizard,
} from "../buildPayload";
import type { WizardData, WizardItem } from "@/pages/faturamento/emitir-nfe/schema";

function mkItem(overrides: Partial<WizardItem> = {}): WizardItem {
  return {
    produto_id: "p1",
    codigo_produto: "SKU-1",
    descricao: "Produto X",
    ncm: "12345678",
    cfop: "5102",
    cst: "00",
    origem_mercadoria: "0",
    unidade: "UN",
    quantidade: 2,
    valor_unitario: 50,
    valor_total: 100,
    icms_aliquota: 18,
    icms_base: 100,
    icms_valor: 18,
    ipi_aliquota: 5,
    ipi_valor: 5,
    pis_aliquota: 1.65,
    pis_valor: 1.65,
    cofins_aliquota: 7.6,
    cofins_valor: 7.6,
    matriz_aplicada: true,
    ...overrides,
  } as WizardItem;
}

function mkData(overrides: Partial<WizardData> = {}): WizardData {
  return {
    serie: "1",
    data_emissao: "2026-01-15",
    natureza_codigo: "5102",
    natureza_descricao: "Venda",
    finalidade: "1",
    tipo_operacao: "saida",
    indicador_presenca: "1",
    data_saida: "",
    hora_saida: "",
    via_intermediador: false,
    intermediador_cnpj: "",
    intermediador_identificador: "",
    cliente_id: "c1",
    cliente_nome: "Cliente X",
    cliente_uf: "SP",
    cliente_municipio_ibge: "3550308",
    itens: [mkItem(), mkItem({ valor_total: 50, icms_valor: 9, ipi_valor: 2.5, pis_valor: 0.825, cofins_valor: 3.8 })],
    frete_modalidade: "9",
    frete_valor: 10,
    outras_despesas: 5,
    desconto_valor: 3,
    transportadora_id: null,
    transportadora_nome: "",
    transportadora_cnpj: "",
    veiculo_placa: "",
    veiculo_uf: "",
    forma_pagamento: "01",
    observacoes: "obs",
    ...overrides,
  } as WizardData;
}

describe("calcularTotaisWizard", () => {
  it("soma impostos de todos os itens e aplica frete/outras/desconto no totalNF", () => {
    const totais = calcularTotaisWizard(mkData());
    expect(totais.valorProdutos).toBe(150);
    expect(totais.totaisIcms).toBeCloseTo(27, 2);
    expect(totais.totaisIpi).toBeCloseTo(7.5, 2);
    expect(totais.totaisPis).toBeCloseTo(2.475, 3);
    expect(totais.totaisCofins).toBeCloseTo(11.4, 2);
    // 150 + 10 + 5 - 3 = 162
    expect(totais.totalNF).toBe(162);
  });

  it("trata strings numéricas e nulos defensivamente", () => {
    const data = mkData({
      frete_valor: Number("" as unknown as string) || 0,
      desconto_valor: 0,
      outras_despesas: 0,
      itens: [mkItem({ valor_total: 0, icms_valor: 0, ipi_valor: 0, pis_valor: 0, cofins_valor: 0 })],
    });
    const t = calcularTotaisWizard(data);
    expect(t.totalNF).toBe(0);
    expect(t.valorProdutos).toBe(0);
  });
});

describe("buildNotaFiscalRascunho", () => {
  it("mapeia finalidade para enum textual e marca status_sefaz = nao_enviada", () => {
    const data = mkData({ finalidade: "4" });
    const totais = calcularTotaisWizard(data);
    const nf = buildNotaFiscalRascunho(data, totais);
    expect(nf.finalidade_nfe).toBe("devolucao");
    expect(nf.status_sefaz).toBe("nao_enviada");
    expect(nf.status).toBe("pendente");
    expect(nf.cliente_id).toBe("c1");
  });

  it("zera intermediador quando via_intermediador é false, ignorando valores residuais", () => {
    const data = mkData({
      via_intermediador: false,
      intermediador_cnpj: "00000000000000",
      intermediador_identificador: "ML-1",
    });
    const nf = buildNotaFiscalRascunho(data, calcularTotaisWizard(data));
    expect(nf.intermediador_cnpj).toBeNull();
    expect(nf.intermediador_identificador).toBeNull();
  });

  it("preserva intermediador quando via_intermediador é true", () => {
    const data = mkData({
      via_intermediador: true,
      intermediador_cnpj: "11222333000181",
      intermediador_identificador: "ML-9",
    });
    const nf = buildNotaFiscalRascunho(data, calcularTotaisWizard(data));
    expect(nf.via_intermediador).toBe(true);
    expect(nf.intermediador_cnpj).toBe("11222333000181");
  });

  it("força UPPERCASE em placa/UF do veículo e null quando ausente", () => {
    const a = buildNotaFiscalRascunho(
      mkData({ veiculo_placa: "abc1d23", veiculo_uf: "sp" }),
      calcularTotaisWizard(mkData()),
    );
    expect(a.veiculo_placa).toBe("ABC1D23");
    expect(a.veiculo_uf).toBe("SP");

    const b = buildNotaFiscalRascunho(
      mkData({ veiculo_placa: "", veiculo_uf: "" }),
      calcularTotaisWizard(mkData()),
    );
    expect(b.veiculo_placa).toBeNull();
    expect(b.veiculo_uf).toBeNull();
  });

  it("normaliza data_saida/hora_saida vazias para null", () => {
    const nf = buildNotaFiscalRascunho(mkData(), calcularTotaisWizard(mkData()));
    expect(nf.data_saida).toBeNull();
    expect(nf.hora_saida).toBeNull();
  });
});

describe("buildItensPayload", () => {
  it("propaga nota_fiscal_id e duplica CST em csosn", () => {
    const itens = [mkItem({ cst: "102" }), mkItem()];
    const payload = buildItensPayload("nf-123", itens);
    expect(payload).toHaveLength(2);
    expect(payload[0].nota_fiscal_id).toBe("nf-123");
    expect(payload[0].csosn).toBe("102");
    expect(payload[0].cst).toBe("102");
    expect(payload[1].csosn).toBe(payload[1].cst);
  });

  it("normaliza codigo_produto vazio para null", () => {
    const payload = buildItensPayload("nf-1", [mkItem({ codigo_produto: "" })]);
    expect(payload[0].codigo_produto).toBeNull();
  });
});