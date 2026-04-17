import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getUserFriendlyError } from "@/utils/errorMessages";

export interface RegistrarBaixaParams {
  lancamentoId: string;
  valorPago: number;
  dataBaixa: string;
  formaPagamento: string;
  contaBancariaId: string;
  observacoes?: string | null;
}

/**
 * Registra baixa transacional (total ou parcial) usando RPC.
 * Atualiza saldo do lançamento, conta bancária e gera movimento de caixa atomicamente.
 */
export function useRegistrarBaixa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: RegistrarBaixaParams) => {
      const { data, error } = await supabase.rpc("registrar_baixa_financeira", {
        p_lancamento_id: params.lancamentoId,
        p_valor_pago: params.valorPago,
        p_data_baixa: params.dataBaixa,
        p_forma_pagamento: params.formaPagamento,
        p_conta_bancaria_id: params.contaBancariaId,
        p_observacoes: params.observacoes ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Baixa registrada com sucesso");
    },
    onError: (error) => {
      console.error("[financeiro] erro ao registrar baixa:", error);
      toast.error(getUserFriendlyError(error));
    },
  });
}

/**
 * Estorna uma baixa específica (devolvendo saldo à conta bancária).
 */
export function useEstornarBaixa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ baixaId, motivo }: { baixaId: string; motivo?: string }) => {
      const { error } = await supabase.rpc("estornar_baixa_financeira", {
        p_baixa_id: baixaId,
        p_motivo: motivo ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Baixa estornada com sucesso");
    },
    onError: (error) => {
      console.error("[financeiro] erro ao estornar baixa:", error);
      toast.error(getUserFriendlyError(error));
    },
  });
}

export interface GerarParcelasParams {
  base: {
    tipo: "receber" | "pagar";
    descricao: string;
    valor: number;
    data_vencimento: string;
    forma_pagamento?: string | null;
    banco?: string | null;
    cartao?: string | null;
    cliente_id?: string | null;
    fornecedor_id?: string | null;
    conta_bancaria_id?: string | null;
    conta_contabil_id?: string | null;
    observacoes?: string | null;
  };
  numParcelas: number;
  intervaloDias?: number;
}

/**
 * Gera parcelas atomicamente (agrupador + N filhas) via RPC.
 */
export function useGerarParcelas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ base, numParcelas, intervaloDias = 30 }: GerarParcelasParams) => {
      const { data, error } = await supabase.rpc("gerar_parcelas_financeiras", {
        p_base: base as never,
        p_num_parcelas: numParcelas,
        p_intervalo_dias: intervaloDias,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      toast.success(`${vars.numParcelas} parcelas geradas com sucesso`);
    },
    onError: (error) => {
      console.error("[financeiro] erro ao gerar parcelas:", error);
      toast.error(getUserFriendlyError(error));
    },
  });
}

/**
 * Gera lançamentos financeiros a partir da folha de pagamento (idempotente).
 */
export function useGerarFinanceiroFolha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ competencia, dataVencimento }: { competencia: string; dataVencimento: string }) => {
      const { data, error } = await supabase.rpc("gerar_financeiro_folha", {
        p_competencia: competencia,
        p_data_vencimento: dataVencimento,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      qc.invalidateQueries({ queryKey: ["folha"] });
      toast.success(count > 0 ? `${count} lançamentos gerados` : "Nenhum lançamento novo a gerar");
    },
    onError: (error) => {
      console.error("[financeiro] erro ao gerar financeiro da folha:", error);
      toast.error(getUserFriendlyError(error));
    },
  });
}
