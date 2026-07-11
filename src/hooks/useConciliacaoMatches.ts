/**
 * Hook da Sprint 2 — expõe as sugestões de conciliação de um extrato
 * e as mutations para (re)gerar matching 1:1/agrupado via RPC.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  autoAprovarExtrato,
  decidirMatchesEmLote,
  listarMatchesDoExtrato,
  sugerirMatchesAgrupados,
  sugerirMatches,
  type DecisaoMatch,
  type SugerirMatchesInput,
} from "@/services/conciliacao/matchingService";

const matchesKey = (extratoId: string) =>
  ["conciliacao", "matches", extratoId] as const;

export function useConciliacaoMatches(extratoId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: matchesKey(extratoId ?? "none"),
    queryFn: () => listarMatchesDoExtrato(extratoId as string),
    enabled: Boolean(extratoId),
  });

  const sugerir = useMutation({
    mutationFn: (input: Omit<SugerirMatchesInput, "extratoId"> | void) =>
      sugerirMatches({ extratoId: extratoId as string, ...(input ?? {}) }),
    onSuccess: () => {
      if (extratoId) {
        void qc.invalidateQueries({ queryKey: matchesKey(extratoId) });
      }
    },
  });

  const sugerirAgrupados = useMutation({
    mutationFn: (input: Omit<SugerirMatchesInput, "extratoId"> | void) =>
      sugerirMatchesAgrupados({ extratoId: extratoId as string, ...(input ?? {}) }),
    onSuccess: () => {
      if (extratoId) {
        void qc.invalidateQueries({ queryKey: matchesKey(extratoId) });
      }
    },
  });

  const decidir = useMutation({
    mutationFn: (args: { ids: string[]; decisao: DecisaoMatch; motivo?: string }) =>
      decidirMatchesEmLote(args.ids, args.decisao, args.motivo),
    onSuccess: () => {
      if (extratoId) {
        void qc.invalidateQueries({ queryKey: matchesKey(extratoId) });
      }
    },
  });

  const autoAprovar = useMutation({
    mutationFn: () => autoAprovarExtrato(extratoId as string),
    onSuccess: () => {
      if (extratoId) {
        void qc.invalidateQueries({ queryKey: matchesKey(extratoId) });
      }
    },
  });

  return { ...query, sugerir, sugerirAgrupados, decidir, autoAprovar };
}