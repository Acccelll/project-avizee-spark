/**
 * Criação inline de lançamento a partir de uma transação do extrato
 * (Épico D — Financeiro Inteligente 2.0).
 *
 * Ao encontrar uma transação sem par no OFX, o usuário pode gerar
 * um `financeiro_lancamentos` já baixado (status "pago") na conta
 * bancária do extrato — em UMA única operação.
 *
 * A baixa automática é feita pela RPC `registrar_baixa_financeira`
 * para garantir a mesma trilha contábil de uma baixa manual.
 */

import { supabase } from "@/integrations/supabase/client";
import { registrarBaixaFinanceiraRpc } from "@/types/rpc";
import type { TransacaoExtrato } from "./ofxParser.service";
import { aplicarRegrasEAliases, carregarRegrasEAliases } from "./matching/rulesEngine.service";

export interface CriarLancamentoInlineInput {
  empresa_id: string;
  conta_bancaria_id: string;
  extrato: TransacaoExtrato;
  descricao?: string;
  fornecedor_id?: string | null;
  cliente_id?: string | null;
  centro_custo_id?: string | null;
  conta_contabil_id?: string | null;
}

export interface CriarLancamentoInlineResult {
  lancamento_id: string;
  baixa_id: string;
  hint_aplicado: boolean;
}

/**
 * Cria o lançamento + baixa em sequência atômica do ponto de vista do usuário.
 *
 * Pré-preenche fornecedor/centro/conta contábil consultando o motor de
 * aliases+regras, quando o chamador não sobrescrever.
 */
export async function criarLancamentoInlineDoExtrato(
  input: CriarLancamentoInlineInput,
): Promise<CriarLancamentoInlineResult> {
  const { extrato } = input;
  const tipo = extrato.valor >= 0 ? "receber" : "pagar";
  const valor = Math.abs(extrato.valor);

  // 1) motor de regras+aliases — só quando o chamador não passou hints
  let hintAplicado = false;
  let fornecedorId = input.fornecedor_id ?? null;
  let clienteId = input.cliente_id ?? null;
  let centroId = input.centro_custo_id ?? null;
  let contaContabilId = input.conta_contabil_id ?? null;

  const semHint =
    !fornecedorId && !clienteId && !centroId && !contaContabilId;
  if (semHint) {
    try {
      const { aliases, regras } = await carregarRegrasEAliases(input.empresa_id);
      const hint = aplicarRegrasEAliases({
        descricao: extrato.descricao,
        tipo: extrato.valor >= 0 ? "credito" : "debito",
        aliases,
        regras,
      });
      if (hint.fonte !== "nenhum") {
        hintAplicado = true;
        fornecedorId = hint.fornecedor_id ?? null;
        clienteId = hint.cliente_id ?? null;
        centroId = hint.centro_custo_id ?? null;
        contaContabilId = hint.conta_contabil_id ?? null;
      }
    } catch {
      // hints são best-effort — falha aqui não impede a criação.
    }
  }

  const { data: lanc, error: insErr } = await supabase
    .from("financeiro_lancamentos")
    .insert({
      empresa_id: input.empresa_id,
      tipo,
      descricao: input.descricao ?? extrato.descricao,
      valor,
      saldo_restante: valor,
      data_vencimento: extrato.data,
      status: "aberto",
      ativo: true,
      conta_bancaria_id: input.conta_bancaria_id,
      fornecedor_id: fornecedorId,
      cliente_id: clienteId,
      centro_custo_id: centroId,
      conta_contabil_id: contaContabilId,
      observacoes: `Criado inline a partir do extrato (${extrato.id})`,
    })
    .select("id")
    .single();
  if (insErr) throw new Error(insErr.message);

  const baixaId = await registrarBaixaFinanceiraRpc({
    p_lancamento_id: lanc.id,
    p_valor_pago: valor,
    p_data_baixa: extrato.data,
    p_forma_pagamento: "extrato_conciliacao",
    p_conta_bancaria_id: input.conta_bancaria_id,
    p_observacoes: `Baixa automática — criação inline (${extrato.id})`,
  });

  return { lancamento_id: lanc.id, baixa_id: baixaId, hint_aplicado: hintAplicado };
}