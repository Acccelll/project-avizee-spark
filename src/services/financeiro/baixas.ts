/**
 * Baixas (settlements) de lançamentos financeiros.
 *
 * Tenta primeiro a RPC consolidada `financeiro_processar_baixa_lote`
 * (transacional). Quando há overrides por item ou a RPC não está disponível,
 * usa fallback estrutural (UPDATE + INSERT por item) já existente.
 *
 * Extraído de `src/services/financeiro.service.ts` (Fase 5 — limpeza estrutural).
 */
import { toast } from "sonner";
import { calcularPagamentoParcialLote } from "@/lib/financeiro";
import { notifyError } from "@/utils/errorMessages";
import { supabase } from "@/integrations/supabase/client";
import {
  registrarBaixaLoteFinanceira,
  type BaixaLoteItemRpc,
} from "@/services/financeiro/baixaRpc";
import { logger } from "@/lib/logger";

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
    const novoSaldo = Math.max(0, saldo - valorPago);
    const novoStatus: "pago" | "parcial" = novoSaldo <= 0.005 ? "pago" : "parcial";

    return { id, saldo, valor, valorPago, novoSaldo, novoStatus };
  });
}

export async function processarBaixaLote(params: BaixaLoteParams): Promise<boolean> {
  try {
    // Filtra inválidos defensivamente
    const plano = criarPlanoBaixaLote(params);

    const items: BaixaLoteItemRpc[] = plano.map((item) => {
      const ovr = params.overrides?.[item.id] ?? {};
      return {
        lancamento_id: item.id,
        valor_pago: ovr.valor_pago ?? item.valorPago,
        data_baixa: ovr.data_baixa ?? params.baixaDate,
        forma_pagamento: ovr.forma_pagamento ?? params.formaPagamento,
        conta_bancaria_id: ovr.conta_bancaria_id ?? params.contaBancariaId,
        observacoes: ovr.observacoes ?? null,
      };
    });

    const result = await registrarBaixaLoteFinanceira({
      items,
      dataBaixa: params.baixaDate,
      formaPagamento: params.formaPagamento,
      contaBancariaId: params.contaBancariaId,
    });

    if (result.erros && result.erros.length > 0) {
      toast.warning(
        `${result.processados} processado(s), ${result.erros.length} erro(s): ${result.erros.slice(0, 2).join("; ")}`,
      );
    } else if (result.ignorados > 0) {
      toast.success(
        `${result.processados} baixado(s); ${result.ignorados} ignorado(s) (já pago/cancelado).`,
      );
    } else {
      toast.success(`${result.processados} lançamento(s) baixado(s) com sucesso!`);
    }
    return result.processados > 0;
  } catch (error) {
    logger.error("[financeiro] erro na baixa em lote:", error);
    notifyError(error);
    return false;
  }
}

// Mantido apenas para compatibilidade de imports — não usado mais.
export async function _legacyProcessarBaixaLoteRpc(): Promise<null> {
  return null;
}

/**
 * Busca baixas ativas (não estornadas) de um lançamento, ordenadas
 * por `data_baixa` desc. Usado por dialogs e drawers.
 */
export interface BaixaAtiva {
  id: string;
  valor_pago: number;
  desconto?: number | null;
  juros?: number | null;
  multa?: number | null;
  abatimento?: number | null;
  data_baixa: string;
  forma_pagamento: string | null;
  observacoes: string | null;
  created_at: string;
}

export async function fetchBaixasAtivasDoLancamento(
  lancamentoId: string,
  signal?: AbortSignal,
): Promise<BaixaAtiva[]> {
  const query = supabase
    .from("financeiro_baixas")
    .select("id, valor_pago, desconto, juros, multa, abatimento, data_baixa, forma_pagamento, observacoes, created_at")
    .eq("lancamento_id", lancamentoId)
    .is("estornada_em", null)
    .order("data_baixa", { ascending: false });
  const { data, error } = signal ? await query.abortSignal(signal) : await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as BaixaAtiva[];
}
/**
 * Sugere a conta bancária de uma nova baixa pelo histórico: a conta da última
 * baixa ativa da mesma pessoa (fornecedor ou cliente); se não houver, a da
 * última baixa com a mesma forma de pagamento. Os títulos em aberto quase
 * nunca trazem conta, por isso a sugestão vem das baixas.
 */
export async function sugerirContaBancariaBaixa(params: {
  fornecedorId?: string | null;
  clienteId?: string | null;
  formaPagamento?: string | null;
}): Promise<string | null> {
  const ultimaConta = async (filtro: { coluna: "fornecedor_id" | "cliente_id"; valor: string } | null) => {
    let q = supabase
      .from("financeiro_baixas")
      .select("conta_bancaria_id, data_baixa, financeiro_lancamentos!inner(fornecedor_id, cliente_id)")
      .is("estornada_em", null)
      .not("conta_bancaria_id", "is", null)
      .order("data_baixa", { ascending: false })
      .limit(1);
    if (filtro) q = q.eq(`financeiro_lancamentos.${filtro.coluna}`, filtro.valor);
    else if (params.formaPagamento) q = q.eq("forma_pagamento", params.formaPagamento);
    else return null;
    const { data, error } = await q;
    if (error) throw error;
    return (data?.[0]?.conta_bancaria_id as string | null | undefined) ?? null;
  };

  if (params.fornecedorId) {
    const c = await ultimaConta({ coluna: "fornecedor_id", valor: params.fornecedorId });
    if (c) return c;
  }
  if (params.clienteId) {
    const c = await ultimaConta({ coluna: "cliente_id", valor: params.clienteId });
    if (c) return c;
  }
  return ultimaConta(null);
}
