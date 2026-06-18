/**
 * Helpers puros (sem I/O) que montam payloads para persistência da NF-e
 * rascunho a partir do estado do wizard. Extraídos de `EmitirNFeWizard.tsx`
 * para isolar a montagem do payload — prepara IBS/CBS NT 2025.002 sem
 * tocar nos componentes de UI.
 */

import { FINALIDADE_MAP, type WizardData, type WizardItem } from "@/pages/faturamento/emitir-nfe/schema";

export interface NotaFiscalRascunhoPayload {
  tipo: string;
  tipo_operacao: string;
  serie: string;
  data_emissao: string;
  natureza_operacao: string;
  finalidade_nfe: string;
  cliente_id: string;
  forma_pagamento: string;
  frete_modalidade: string;
  frete_valor: number;
  outras_despesas: number;
  desconto_valor: number;
  observacoes: string | null;
  indicador_presenca: string;
  data_saida: string | null;
  hora_saida: string | null;
  transportadora_id: string | null;
  veiculo_placa: string | null;
  veiculo_uf: string | null;
  via_intermediador: boolean;
  intermediador_cnpj: string | null;
  intermediador_identificador: string | null;
  valor_produtos: number;
  valor_total: number;
  icms_valor: number;
  ipi_valor: number;
  pis_valor: number;
  cofins_valor: number;
  status: string;
  status_sefaz: string;
  ordem_venda_id: string | null;
  nf_referenciada_id: string | null;
  nf_referenciada_chave: string | null;
}

export interface NotaFiscalItemPayload {
  nota_fiscal_id: string;
  produto_id: string | null;
  codigo_produto: string | null;
  descricao: string;
  ncm: string;
  cfop: string;
  cst: string;
  csosn: string;
  origem_mercadoria: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  icms_base: number;
  icms_aliquota: number;
  icms_valor: number;
  ipi_aliquota: number;
  ipi_valor: number;
  pis_aliquota: number;
  pis_valor: number;
  cofins_aliquota: number;
  cofins_valor: number;
}

export interface TotaisWizard {
  totalNF: number;
  totaisIcms: number;
  totaisIpi: number;
  totaisPis: number;
  totaisCofins: number;
  valorProdutos: number;
}

export function calcularTotaisWizard(data: WizardData): TotaisWizard {
  const totaisIcms = data.itens.reduce((s, i) => s + Number(i.icms_valor || 0), 0);
  const totaisIpi = data.itens.reduce((s, i) => s + Number(i.ipi_valor || 0), 0);
  const totaisPis = data.itens.reduce((s, i) => s + Number(i.pis_valor || 0), 0);
  const totaisCofins = data.itens.reduce((s, i) => s + Number(i.cofins_valor || 0), 0);
  const valorProdutos = data.itens.reduce((s, i) => s + Number(i.valor_total || 0), 0);
  const totalNF = +(
    valorProdutos +
    Number(data.frete_valor || 0) +
    Number(data.outras_despesas || 0) -
    Number(data.desconto_valor || 0)
  ).toFixed(2);
  return { totalNF, totaisIcms, totaisIpi, totaisPis, totaisCofins, valorProdutos };
}

export function buildNotaFiscalRascunho(
  data: WizardData,
  totais: TotaisWizard,
): NotaFiscalRascunhoPayload {
  return {
    tipo: data.tipo_operacao,
    tipo_operacao: data.tipo_operacao,
    serie: data.serie,
    data_emissao: data.data_emissao,
    natureza_operacao: data.natureza_descricao,
    finalidade_nfe: FINALIDADE_MAP[data.finalidade] ?? "normal",
    cliente_id: data.cliente_id,
    forma_pagamento: data.forma_pagamento,
    frete_modalidade: data.frete_modalidade,
    frete_valor: data.frete_valor,
    outras_despesas: data.outras_despesas,
    desconto_valor: data.desconto_valor,
    observacoes: data.observacoes ?? null,
    indicador_presenca: data.indicador_presenca,
    data_saida: data.data_saida || null,
    hora_saida: data.hora_saida || null,
    transportadora_id: data.transportadora_id ?? null,
    veiculo_placa: data.veiculo_placa ? data.veiculo_placa.toUpperCase() : null,
    veiculo_uf: data.veiculo_uf ? data.veiculo_uf.toUpperCase() : null,
    via_intermediador: data.via_intermediador ?? false,
    intermediador_cnpj: data.via_intermediador ? (data.intermediador_cnpj || null) : null,
    intermediador_identificador: data.via_intermediador
      ? (data.intermediador_identificador || null)
      : null,
    valor_produtos: totais.valorProdutos,
    valor_total: totais.totalNF,
    icms_valor: totais.totaisIcms,
    ipi_valor: totais.totaisIpi,
    pis_valor: totais.totaisPis,
    cofins_valor: totais.totaisCofins,
    status: "pendente",
    status_sefaz: "nao_enviada",
    ordem_venda_id: data.ordem_venda_id ?? null,
    nf_referenciada_id: data.nf_referenciada_id ?? null,
    nf_referenciada_chave: data.nf_referenciada_chave ?? null,
  };
}

export function buildItensPayload(
  notaFiscalId: string,
  itens: WizardItem[],
): NotaFiscalItemPayload[] {
  return itens.map((it) => ({
    nota_fiscal_id: notaFiscalId,
    produto_id: it.produto_id,
    codigo_produto: it.codigo_produto || null,
    descricao: it.descricao,
    ncm: it.ncm,
    cfop: it.cfop,
    cst: it.cst,
    csosn: it.cst,
    origem_mercadoria: it.origem_mercadoria,
    unidade: it.unidade,
    quantidade: it.quantidade,
    valor_unitario: it.valor_unitario,
    valor_total: it.valor_total,
    icms_base: it.icms_base,
    icms_aliquota: it.icms_aliquota,
    icms_valor: it.icms_valor,
    ipi_aliquota: it.ipi_aliquota,
    ipi_valor: it.ipi_valor,
    pis_aliquota: it.pis_aliquota,
    pis_valor: it.pis_valor,
    cofins_aliquota: it.cofins_aliquota,
    cofins_valor: it.cofins_valor,
  }));
}