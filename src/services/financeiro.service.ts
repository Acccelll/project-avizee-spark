import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import {
  calcularPagamentoParcialLote,
  calcularNovoSaldo,
  statusPosBaixa,
} from "@/lib/financeiro";
import { getUserFriendlyError } from "@/utils/errorMessages";

type LancamentoUpdate = Database["public"]["Tables"]["financeiro_lancamentos"]["Update"];
type BaixaInsert = Database["public"]["Tables"]["financeiro_baixas"]["Insert"];

interface ProcessarBaixaLoteRpcArgs {
  p_selected_ids: string[];
  p_tipo_baixa: "total" | "parcial";
  p_valor_pago_baixa: number;
  p_total_baixa: number;
  p_baixa_date: string;
  p_forma_pagamento: string;
  p_conta_bancaria_id: string;
}

interface ProcessarEstornoRpcArgs {
  p_lancamento_id: string;
  p_motivo_estorno: string | null;
}

export interface BaixaLoteParams {
  selectedIds: string[];
  selectedLancamentos: Array<{ id: string; valor: number; saldo_restante: number | null }>;
  tipoBaixa: "total" | "parcial";
  valorPagoBaixa: number;
  totalBaixa: number;
  baixaDate: string;
  formaPagamento: string;
  contaBancariaId: string;
}

interface BaixaPlanItem {
  id: string;
  saldo: number;
  valor: number;
  valorPago: number;
  novoSaldo: number;
  novoStatus: "pago" | "parcial";
}

export function criarPlanoBaixaLote(params: BaixaLoteParams): BaixaPlanItem[] {
  const { selectedIds, selectedLancamentos, tipoBaixa, valorPagoBaixa, totalBaixa } = params;

  if (!selectedIds.length) {
    throw new Error("Nenhum lançamento selecionado para baixa em lote.");
  }

  if (!params.formaPagamento || !params.contaBancariaId || !params.baixaDate) {
    throw new Error("Dados obrigatórios da baixa não informados.");
  }

  if (tipoBaixa === "parcial" && (totalBaixa <= 0 || valorPagoBaixa <= 0)) {
    throw new Error("Baixa parcial inválida: valores devem ser maiores que zero.");
  }

  const ratio = tipoBaixa === "parcial" ? valorPagoBaixa / totalBaixa : 1;

  return selectedIds.map((id) => {
    const found = selectedLancamentos.find((item) => item.id === id);
    if (!found) {
      throw new Error(`Lançamento ${id} não encontrado na seleção.`);
    }

    const saldo = Number(found.saldo_restante != null ? found.saldo_restante : found.valor);
    const valor = Number(found.valor);
    const valorPago = tipoBaixa === "total" ? saldo : calcularPagamentoParcialLote(saldo, ratio);
    const novoSaldo = tipoBaixa === "total" ? 0 : calcularNovoSaldo(saldo, valorPago, 0);
    const novoStatus = tipoBaixa === "total" ? "pago" : statusPosBaixa(novoSaldo);

    return { id, saldo, valor, valorPago, novoSaldo, novoStatus };
  });
}

async function ensureUpdateLancamento(item: BaixaPlanItem, params: BaixaLoteParams) {
  const payload = {
    status: item.novoStatus,
    data_pagamento: item.novoStatus === "pago" ? params.baixaDate : null,
    valor_pago: item.valor - item.novoSaldo,
    tipo_baixa: params.tipoBaixa,
    forma_pagamento: params.formaPagamento,
    conta_bancaria_id: params.contaBancariaId,
    saldo_restante: item.novoSaldo,
  };

  const { data, error } = await supabase
    .from("financeiro_lancamentos")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(payload as any)
    .eq("id", item.id)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) {
    throw new Error(`Falha ao atualizar lançamento ${item.id}. Nenhuma linha afetada.`);
  }
}

async function ensureInsertBaixa(item: BaixaPlanItem, params: BaixaLoteParams) {
  const { data, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("financeiro_baixas" as any)
    .insert({
      lancamento_id: item.id,
      valor_pago: item.valorPago,
      data_baixa: params.baixaDate,
      forma_pagamento: params.formaPagamento,
      conta_bancaria_id: params.contaBancariaId,
    })
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) {
    throw new Error(`Falha ao inserir baixa para lançamento ${item.id}.`);
  }
}

async function processarBaixaLoteRpc(params: BaixaLoteParams): Promise<boolean | null> {
  const { error } = await supabase.rpc("financeiro_processar_baixa_lote", {
    p_selected_ids: params.selectedIds,
    p_tipo_baixa: params.tipoBaixa,
    p_valor_pago_baixa: params.valorPagoBaixa,
    p_total_baixa: params.totalBaixa,
    p_baixa_date: params.baixaDate,
    p_forma_pagamento: params.formaPagamento,
    p_conta_bancaria_id: params.contaBancariaId,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  if (!error) return true;

  if (String(error.message || "").toLowerCase().includes("function financeiro_processar_baixa_lote") || error.code === "PGRST202") {
    return null;
  }

  throw error;
}

export async function processarBaixaLote(params: BaixaLoteParams): Promise<boolean> {
  try {
    const rpcResult = await processarBaixaLoteRpc(params);
    if (rpcResult === true) {
      toast.success(`${params.selectedIds.length} lançamento(s) processado(s) com sucesso!`);
      return true;
    }

    const plano = criarPlanoBaixaLote(params);

    const processados: string[] = [];
    for (const item of plano) {
      await ensureUpdateLancamento(item, params);
      await ensureInsertBaixa(item, params);
      processados.push(item.id);
    }

    if (params.tipoBaixa === "total") {
      toast.success(`${processados.length} lançamento(s) baixado(s) integralmente!`);
    } else {
      toast.success(`Baixa parcial registrada para ${processados.length} lançamento(s)!`);
    }

    return true;
  } catch (error) {
    console.error("[financeiro] erro na baixa em lote:", error);
    toast.error(getUserFriendlyError(error));
    return false;
  }
}

async function processarEstornoRpc(lancamentoId: string, motivoEstorno?: string): Promise<boolean | null> {
  const { error } = await supabase.rpc("financeiro_processar_estorno", {
    p_lancamento_id: lancamentoId,
    p_motivo_estorno: motivoEstorno ?? null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  if (!error) return true;

  if (String(error.message || "").toLowerCase().includes("function financeiro_processar_estorno") || error.code === "PGRST202") {
    return null;
  }

  throw error;
}

export async function processarEstorno(lancamentoId: string, motivoEstorno?: string): Promise<boolean> {
  try {
    const rpcResult = await processarEstornoRpc(lancamentoId, motivoEstorno);
    if (rpcResult === true) {
      toast.success("Estorno realizado com sucesso!");
      return true;
    }

    const { data: lanc, error: lancError } = await supabase
      .from("financeiro_lancamentos")
      .select("id,status,valor")
      .eq("id", lancamentoId)
      .maybeSingle();

    if (lancError) throw lancError;
    if (!lanc?.id) throw new Error("Lançamento não encontrado para estorno.");

    const { data: upd, error: updateError } = await supabase
      .from("financeiro_lancamentos")
      .update({
        status: "estornado",
        data_pagamento: null,
        valor_pago: 0,
        tipo_baixa: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        saldo_restante: Number((lanc as any).valor ?? 0),
        motivo_estorno: motivoEstorno || null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .eq("id", lancamentoId)
      .select("id")
      .maybeSingle();

    if (updateError) throw updateError;
    if (!upd?.id) throw new Error("Falha ao atualizar lançamento no estorno.");

    const { error: parcelasError } = await supabase
      .from("financeiro_lancamentos")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ ativo: false } as any)
      .eq("documento_pai_id", lancamentoId);
    if (parcelasError) throw parcelasError;

    toast.success("Estorno realizado com sucesso!");
    return true;
  } catch (error) {
    console.error("[financeiro] erro ao estornar:", error);
    toast.error(getUserFriendlyError(error));
    return false;
  }
}

/** Re-exported from `@/lib/financeiro` for backward compatibility. */
export { getEffectiveStatus } from "@/lib/financeiro";
