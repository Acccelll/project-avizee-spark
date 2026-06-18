import type { OrcamentoFormValues } from "@/lib/orcamentoSchema";
import type { ClienteSnapshot, SalvarOrcamentoPayload } from "./types";

export interface BuildOrcamentoPayloadArgs {
  formValues: OrcamentoFormValues;
  isEdit: boolean;
  totals: { valorTotal: number; quantidadeTotal: number; pesoTotal: number };
  clienteSnapshot: ClienteSnapshot;
  frete: {
    transportadoraId: string | null;
    simulacaoId: string | null;
    origem: string | null;
    servico: string | null;
    prazoDias: number | null;
    volumes: number | null;
    alturaCm: number | null;
    larguraCm: number | null;
    comprimentoCm: number | null;
  };
  override?: Partial<{ numero: string; status: string; validade: string | null }>;
}

/**
 * Monta o payload p_payload da RPC salvar_orcamento.
 * Em "novo" (não isEdit) deixa numero em branco para que a RPC gere
 * o número definitivo via proximo_numero_orcamento() de forma atômica.
 */
export function buildOrcamentoPayload(args: BuildOrcamentoPayloadArgs): SalvarOrcamentoPayload {
  const { formValues, isEdit, totals, clienteSnapshot, frete, override } = args;
  const numeroFinal = override?.numero ?? (isEdit ? formValues.numero : "");
  return {
    numero: numeroFinal,
    data_orcamento: formValues.dataOrcamento,
    status: override?.status ?? formValues.status,
    cliente_id: formValues.clienteId || null,
    validade: override?.validade !== undefined ? override.validade : (formValues.validade || null),
    observacoes: formValues.observacoes,
    observacoes_internas: formValues.observacoesInternas || null,
    desconto: formValues.desconto,
    imposto_st: formValues.impostoSt,
    imposto_ipi: formValues.impostoIpi,
    frete_valor: formValues.freteValor,
    outras_despesas: formValues.outrasDespesas,
    valor_total: totals.valorTotal,
    quantidade_total: totals.quantidadeTotal,
    peso_total: totals.pesoTotal,
    pagamento: formValues.pagamento,
    prazo_pagamento: formValues.prazoPagamento,
    prazo_entrega: formValues.prazoEntrega,
    // frete_tipo aceita só CIF/FOB/sem_frete; texto livre vai para servico_frete.
    frete_tipo: ['CIF', 'FOB', 'sem_frete'].includes(formValues.freteTipo || '')
      ? formValues.freteTipo
      : (formValues.modalidade || ''),
    modalidade: formValues.modalidade,
    cliente_snapshot: clienteSnapshot,
    transportadora_id: frete.transportadoraId || null,
    frete_simulacao_id: frete.simulacaoId || null,
    origem_frete: frete.origem || null,
    servico_frete: formValues.servicoFrete || frete.servico || null,
    prazo_entrega_dias: frete.prazoDias || null,
    volumes: frete.volumes || null,
    altura_cm: frete.alturaCm || null,
    largura_cm: frete.larguraCm || null,
    comprimento_cm: frete.comprimentoCm || null,
  };
}