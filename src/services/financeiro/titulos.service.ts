/**
 * Serviço de operações com títulos financeiros (comunicação com Supabase).
 *
 * Centraliza as operações de baixa, negociação e antecipação de títulos,
 * removendo essa lógica dos componentes de UI.
 */

import { supabase } from "@/integrations/supabase/client";
import { gerarParcelas } from "./calculosFinanceiros.service";
import type { Parcela } from "./calculosFinanceiros.service";

export type { Parcela };

/** Dados necessários para realizar a baixa de um título. */
export interface BaixaTituloData {
  valorPago: number;
  desconto?: number;
  juros?: number;
  multa?: number;
  abatimento?: number;
  dataBaixa: string; // ISO 8601 "YYYY-MM-DD"
  formaPagamento: string;
  contaBancariaId: string;
  observacoes?: string;
}

/** Dados necessários para negociar (reparcelar) um título. */
export interface NegociacaoData {
  numParcelas: number;
  dataPrimeiroVencimento: Date;
  intervaloDias?: number;
  descricaoBase: string;
  tipo: string;
  formaPagamento?: string;
  contaBancariaId?: string;
  observacoes?: string;
}

/** Dados necessários para antecipar um título. */
export interface AntecipacaoData {
  dataAntecipacao: string; // ISO 8601 "YYYY-MM-DD"
  valorAntecipado: number;
  desconto?: number;
  formaPagamento: string;
  contaBancariaId: string;
  observacoes?: string;
}

/**
 * Realiza a baixa (pagamento) de um título financeiro.
 *
 * Registra um lançamento na tabela `financeiro_baixas` e atualiza o status
 * e saldo do lançamento em `financeiro_lancamentos`.
 *
 * @param id         ID do lançamento a ser baixado.
 * @param dadosBaixa Dados do pagamento (valor, datas, forma, conta).
 */
export async function baixarTitulo(
  id: string,
  dadosBaixa: BaixaTituloData,
): Promise<void> {
  const {
    valorPago,
    desconto = 0,
    juros = 0,
    multa = 0,
    abatimento = 0,
    dataBaixa,
    formaPagamento,
    contaBancariaId,
    observacoes,
  } = dadosBaixa;

  // Buscar saldo atual
  const { data: lancamento, error: fetchError } = await supabase
    .from("financeiro_lancamentos")
    .select("saldo_restante, valor")
    .eq("id", id)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  const saldoAtual =
    lancamento.saldo_restante != null
      ? Number(lancamento.saldo_restante)
      : Number(lancamento.valor);

  const novoSaldo = Math.max(0, saldoAtual - valorPago - abatimento);
  const novoStatus = novoSaldo <= 0.01 ? "pago" : "parcial";

  // Inserir registro de baixa
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: baixaError } = await (supabase.from as any)("financeiro_baixas").insert({
    lancamento_id: id,
    valor_pago: valorPago,
    desconto,
    juros,
    multa,
    abatimento,
    data_baixa: dataBaixa,
    forma_pagamento: formaPagamento,
    conta_bancaria_id: contaBancariaId,
    observacoes: observacoes ?? null,
  });

  if (baixaError) throw new Error(baixaError.message);

  // Atualizar lançamento
  const { error: updateError } = await supabase
    .from("financeiro_lancamentos")
    .update({
      saldo_restante: novoSaldo,
      status: novoStatus,
      data_pagamento: novoStatus === "pago" ? dataBaixa : null,
      forma_pagamento: formaPagamento,
      conta_bancaria_id: contaBancariaId,
    })
    .eq("id", id);

  if (updateError) throw new Error(updateError.message);
}

/**
 * Negocia (reparcelamento) um título financeiro.
 *
 * Cancela o título original e gera novas parcelas conforme os parâmetros
 * informados, criando novos lançamentos na tabela `financeiro_lancamentos`.
 *
 * @param id              ID do lançamento original a ser negociado.
 * @param dadosNegociacao Parâmetros de negociação (parcelas, datas, etc.).
 */
export async function negociarTitulo(
  id: string,
  dadosNegociacao: NegociacaoData,
): Promise<void> {
  const {
    numParcelas,
    dataPrimeiroVencimento,
    intervaloDias = 30,
    descricaoBase,
    tipo,
    formaPagamento,
    contaBancariaId,
    observacoes,
  } = dadosNegociacao;

  // Buscar saldo devedor atual
  const { data: lancamento, error: fetchError } = await supabase
    .from("financeiro_lancamentos")
    .select("saldo_restante, valor")
    .eq("id", id)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  const valorNegociado =
    lancamento.saldo_restante != null
      ? Number(lancamento.saldo_restante)
      : Number(lancamento.valor);

  const parcelas = gerarParcelas(
    valorNegociado,
    numParcelas,
    dataPrimeiroVencimento,
    intervaloDias,
  );

  // Cancelar título original
  const { error: cancelError } = await supabase
    .from("financeiro_lancamentos")
    .update({ status: "cancelado" })
    .eq("id", id);

  if (cancelError) throw new Error(cancelError.message);

  // Criar novas parcelas
  for (const parcela of parcelas) {
    const { error: insertError } = await supabase
      .from("financeiro_lancamentos")
      .insert({
        tipo,
        descricao: `${descricaoBase} - ${parcela.numero}/${numParcelas}`,
        valor: parcela.valor,
        data_vencimento: parcela.dataVencimento,
        status: "aberto",
        forma_pagamento: formaPagamento ?? null,
        conta_bancaria_id: contaBancariaId ?? null,
        documento_pai_id: id,
        parcela_numero: parcela.numero,
        parcela_total: numParcelas,
        observacoes: observacoes ?? null,
        ativo: true,
      });

    if (insertError) throw new Error(insertError.message);
  }
}

/**
 * Antecipa o vencimento de um título financeiro.
 *
 * Registra um pagamento adiantado e atualiza a data e status do lançamento.
 *
 * @param id                  ID do lançamento a ser antecipado.
 * @param dadosAntecipacao    Dados da antecipação.
 */
export async function anteciparTitulo(
  id: string,
  dadosAntecipacao: AntecipacaoData,
): Promise<void> {
  const {
    dataAntecipacao,
    valorAntecipado,
    desconto = 0,
    formaPagamento,
    contaBancariaId,
    observacoes,
  } = dadosAntecipacao;

  // Buscar saldo atual
  const { data: lancamento, error: fetchError } = await supabase
    .from("financeiro_lancamentos")
    .select("saldo_restante, valor")
    .eq("id", id)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  const saldoAtual =
    lancamento.saldo_restante != null
      ? Number(lancamento.saldo_restante)
      : Number(lancamento.valor);

  const novoSaldo = Math.max(0, saldoAtual - valorAntecipado - desconto);
  const novoStatus = novoSaldo <= 0.01 ? "pago" : "parcial";

  // Inserir registro de baixa (antecipação)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: baixaError } = await (supabase.from as any)("financeiro_baixas").insert({
    lancamento_id: id,
    valor_pago: valorAntecipado,
    desconto,
    data_baixa: dataAntecipacao,
    forma_pagamento: formaPagamento,
    conta_bancaria_id: contaBancariaId,
    observacoes: observacoes ?? null,
  });

  if (baixaError) throw new Error(baixaError.message);

  const { error: updateError } = await supabase
    .from("financeiro_lancamentos")
    .update({
      saldo_restante: novoSaldo,
      status: novoStatus,
      data_vencimento: dataAntecipacao,
      data_pagamento: novoStatus === "pago" ? dataAntecipacao : null,
      forma_pagamento: formaPagamento,
      conta_bancaria_id: contaBancariaId,
    })
    .eq("id", id);

  if (updateError) throw new Error(updateError.message);
}
