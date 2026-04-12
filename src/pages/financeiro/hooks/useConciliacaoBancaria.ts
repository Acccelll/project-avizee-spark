/**
 * Hook para gerenciar o processo de conciliação bancária.
 *
 * Integra React Query para busca de extratos e lançamentos pendentes,
 * e expõe funções para importar, conciliar e desconciliar transações.
 */

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/errorMessages";
import { parseOFX, type TransacaoExtrato } from "@/services/financeiro/ofxParser.service";
import {
  sugerirConciliacao,
  conciliarTransacao,
  type TituloParaConciliacao,
} from "@/services/financeiro/conciliacao.service";

/** Par de conciliação: transação do extrato ↔ lançamento ERP. */
export interface ParConciliacao {
  extratoId: string;
  lancamentoId: string;
}

/** Estado completo do processo de conciliação para uma conta. */
export interface ConciliacaoState {
  contaId: string;
  extratoItems: TransacaoExtrato[];
  pares: ParConciliacao[];
}

/** Resultado do hook `useConciliacaoBancaria`. */
export interface UseConciliacaoBancariaResult {
  /** Lançamentos pendentes da conta no período selecionado. */
  lancamentos: TituloParaConciliacao[];
  loadingLancamentos: boolean;

  /** Transações do extrato importado. */
  extratoItems: TransacaoExtrato[];

  /** Pares de conciliação confirmados (ainda não persistidos). */
  pares: ParConciliacao[];

  /** Lê um arquivo OFX e popula `extratoItems`. */
  importarExtrato: (file: File) => Promise<void>;

  /** Confirma um par extrato ↔ lançamento (ou sobrescreve existente). */
  confirmarPar: (extratoId: string, lancamentoId: string) => void;

  /** Remove o par associado a uma transação do extrato. */
  removerPar: (extratoId: string) => void;

  /** Executa a conciliação automática por valor e data. */
  autoMatch: () => void;

  /** Persiste os pares confirmados no banco de dados. */
  conciliar: () => Promise<void>;
  conciliando: boolean;
}

/**
 * Hook que gerencia o estado e as operações de conciliação bancária.
 *
 * @param contaId     ID da conta bancária selecionada.
 * @param dataInicio  Data inicial do período (ISO 8601 "YYYY-MM-DD").
 * @param dataFim     Data final do período (ISO 8601 "YYYY-MM-DD").
 */
export function useConciliacaoBancaria(
  contaId: string,
  dataInicio: string,
  dataFim: string,
): UseConciliacaoBancariaResult {
  const queryClient = useQueryClient();
  const [extratoItems, setExtratoItems] = useState<TransacaoExtrato[]>([]);
  const [pares, setPares] = useState<ParConciliacao[]>([]);

  // ── Busca de lançamentos pendentes via React Query ────────────────────────
  const { data: lancamentos = [], isLoading: loadingLancamentos } = useQuery({
    queryKey: ["conciliacao-lancamentos", contaId, dataInicio, dataFim],
    queryFn: async (): Promise<TituloParaConciliacao[]> => {
      if (!contaId) return [];

      const { data, error } = await supabase
        .from("financeiro_lancamentos")
        .select("id, descricao, valor, data_vencimento, tipo, status")
        .eq("ativo", true)
        .eq("conta_bancaria_id", contaId)
        .gte("data_vencimento", dataInicio)
        .lte("data_vencimento", dataFim)
        .order("data_vencimento", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as TituloParaConciliacao[];
    },
    enabled: Boolean(contaId),
  });

  // ── Importar extrato OFX ──────────────────────────────────────────────────
  const importarExtrato = useCallback(async (file: File) => {
    const transacoes = await parseOFX(file);
    setExtratoItems(transacoes);
    setPares([]);
    toast.success(`${transacoes.length} transação(ões) importada(s) do extrato.`);
  }, []);

  // ── Gestão de pares ───────────────────────────────────────────────────────
  const confirmarPar = useCallback((extratoId: string, lancamentoId: string) => {
    setPares((prev) => {
      const semEstePar = prev.filter((p) => p.extratoId !== extratoId);
      return [...semEstePar, { extratoId, lancamentoId }];
    });
  }, []);

  const removerPar = useCallback((extratoId: string) => {
    setPares((prev) => prev.filter((p) => p.extratoId !== extratoId));
  }, []);

  // ── Auto-match por valor e data ───────────────────────────────────────────
  const autoMatch = useCallback(() => {
    const usados = new Set<string>();
    const novosPares: ParConciliacao[] = [];

    for (const extrato of extratoItems) {
      const disponiveis = lancamentos.filter((l) => !usados.has(l.id));
      const sugestao = sugerirConciliacao(extrato, disponiveis);
      if (sugestao) {
        novosPares.push({ extratoId: extrato.id, lancamentoId: sugestao.id });
        usados.add(sugestao.id);
      }
    }

    setPares(novosPares);
    toast.success(`${novosPares.length} par(es) encontrado(s) automaticamente.`);
  }, [extratoItems, lancamentos]);

  // ── Persistir conciliação ─────────────────────────────────────────────────
  const { mutateAsync: persistirConciliacao, isPending: conciliando } = useMutation({
    mutationFn: async () => {
      if (!contaId || pares.length === 0) {
        throw new Error("Nenhum par para conciliar.");
      }

      await Promise.all(
        pares.map((par) => {
          const transacao = extratoItems.find((e) => e.id === par.extratoId);
          if (!transacao) return Promise.resolve();
          return conciliarTransacao(contaId, transacao, par.lancamentoId);
        })
      );
    },
    onSuccess: () => {
      toast.success(`${pares.length} transação(ões) conciliada(s) com sucesso!`);
      setPares([]);
      queryClient.invalidateQueries({
        queryKey: ["conciliacao-lancamentos", contaId],
      });
    },
    onError: (err) => {
      toast.error(getUserFriendlyError(err));
    },
  });

  return {
    lancamentos,
    loadingLancamentos,
    extratoItems,
    pares,
    importarExtrato,
    confirmarPar,
    removerPar,
    autoMatch,
    conciliar: persistirConciliacao,
    conciliando,
  };
}
