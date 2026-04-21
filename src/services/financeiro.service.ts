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

export interface BaixaItemOverride {
  data_baixa?: string;
  forma_pagamento?: string;
  conta_bancaria_id?: string;
  valor_pago?: number;
  observacoes?: string;
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
  overrides?: Record<string, BaixaItemOverride>;
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
  const ovr = params.overrides?.[item.id] ?? {};
  const dataPagamento = ovr.data_baixa ?? params.baixaDate;
  const formaPagamento = ovr.forma_pagamento ?? params.formaPagamento;
  const contaBancariaId = ovr.conta_bancaria_id ?? params.contaBancariaId;
  const payload = {
    status: item.novoStatus,
    data_pagamento: item.novoStatus === "pago" ? dataPagamento : null,
    valor_pago: item.valor - item.novoSaldo,
    tipo_baixa: params.tipoBaixa,
    forma_pagamento: formaPagamento,
    conta_bancaria_id: contaBancariaId,
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
  const ovr = params.overrides?.[item.id] ?? {};
  const { data, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("financeiro_baixas" as any)
    .insert({
      lancamento_id: item.id,
      valor_pago: ovr.valor_pago ?? item.valorPago,
      data_baixa: ovr.data_baixa ?? params.baixaDate,
      forma_pagamento: ovr.forma_pagamento ?? params.formaPagamento,
      conta_bancaria_id: ovr.conta_bancaria_id ?? params.contaBancariaId,
      observacoes: ovr.observacoes ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error) throw error;
  const inserted = data as { id?: string } | null;
  if (!inserted?.id) {
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
    // 1) Tenta a RPC consolidada (estorna todas as baixas ativas em transação).
    const rpcResult = await processarEstornoRpc(lancamentoId, motivoEstorno);
    if (rpcResult === true) {
      toast.success("Estorno realizado com sucesso!");
      return true;
    }

    // 2) Fallback estrutural: estorna LOGICAMENTE cada baixa ativa via `estornar_baixa_financeira`.
    //    O trigger trg_sync_financeiro_saldo recalcula valor_pago/saldo/status automaticamente.
    const { data: baixas, error: baixasError } = await supabase
      .from("financeiro_baixas")
      .select("id")
      .eq("lancamento_id", lancamentoId)
      .is("estornada_em", null);

    if (baixasError) throw baixasError;
    if (!baixas || baixas.length === 0) {
      throw new Error("Nenhuma baixa ativa encontrada para estornar.");
    }

    for (const b of baixas) {
      const { error: estError } = await supabase.rpc("estornar_baixa_financeira", {
        p_baixa_id: b.id,
        p_motivo: motivoEstorno || "Estorno via interface",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      if (estError) throw estError;
    }

    toast.success("Estorno realizado com sucesso!");
    return true;
  } catch (error) {
    console.error("[financeiro] erro ao estornar:", error);
    toast.error(getUserFriendlyError(error));
    return false;
  }
}

/**
 * Cancela um lançamento financeiro (não pago, sem baixas ativas) via RPC oficial.
 * Mantém o registro no banco com status='cancelado' e preserva a trilha.
 */
export async function cancelarLancamento(lancamentoId: string, motivo: string): Promise<boolean> {
  try {
    if (!motivo || motivo.trim().length < 5) {
      toast.error("Informe um motivo para o cancelamento (mínimo 5 caracteres).");
      return false;
    }
    const { error } = await supabase.rpc("financeiro_cancelar_lancamento", {
      p_id: lancamentoId,
      p_motivo: motivo.trim(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    if (error) throw error;
    toast.success("Lançamento cancelado com sucesso.");
    return true;
  } catch (error) {
    console.error("[financeiro] erro ao cancelar:", error);
    toast.error(getUserFriendlyError(error));
    return false;
  }
}

/** Re-exported from `@/lib/financeiro` for backward compatibility. */
export { getEffectiveStatus } from "@/lib/financeiro";
