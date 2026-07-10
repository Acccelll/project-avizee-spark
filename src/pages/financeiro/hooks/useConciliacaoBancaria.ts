/**
 * Hook para gerenciar o processo de conciliação bancária.
 *
 * Integra React Query para busca de extratos e lançamentos pendentes,
 * e expõe funções para importar, conciliar e desconciliar transações.
 */

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notifyError } from "@/utils/errorMessages";
import { parseOFX, type TransacaoExtrato } from "@/services/financeiro/ofxParser.service";
import {
  sugerirConciliacao,
  conciliarTransacao,
  sugerirConciliacaoIa,
  type TituloParaConciliacao,
} from "@/services/financeiro/conciliacao.service";
import {
  listLancamentosParaConciliacao,
  sugerirConciliacaoBancariaRpc,
} from "@/services/financeiro/conciliacaoQueries";
import {
  persistirExtratoOFX,
  listarExtratoPersistido,
  type ExtratoTransacaoPersistida,
} from "@/services/financeiro/extratoImportacoes.service";
import { registrarFeedbackMatching } from "@/services/financeiro/matching/feedback.service";
import { useState } from "react";

/** Par de conciliação: transação do extrato ↔ lançamento ERP. */
export interface ParConciliacao {
  extratoId: string;
  lancamentoId: string;
  /** Origem da sugestão: heurística determinística ou IA fallback. */
  origem?: "heuristica" | "ia" | "sugestao";
  /** Justificativa textual quando origem === "ia". */
  justificativa?: string;
  /** Score original da sugestão persistida (Motor Inteligente). */
  sugestaoScore?: number | null;
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

  /** Aceita todas as sugestões persistidas com score ≥ minScore. */
  aceitarSugestoesPersistidas: (minScore?: number) => number;

  /** Sugestões persistidas mapeadas por extratoId. */
  sugestoesPersistidas: Map<string, { lancamentoId: string; score: number; motivos: string[] | null }>;

  /** Extrato bruto persistido (com campos do Motor Inteligente). */
  extratoPersistido: ExtratoTransacaoPersistida[];

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
  const [pares, setPares] = useState<ParConciliacao[]>([]);

  // ── Busca de lançamentos pendentes via React Query ────────────────────────
  const { data: lancamentos = [], isLoading: loadingLancamentos } = useQuery({
    queryKey: ["conciliacao-lancamentos", contaId, dataInicio, dataFim],
    queryFn: () => listLancamentosParaConciliacao({ contaId, dataInicio, dataFim }),
    enabled: Boolean(contaId),
  });

  // ── Extrato persistido (sobrevive a reload) ───────────────────────────────
  const { data: extratoPersistido = [] } = useQuery<ExtratoTransacaoPersistida[]>({
    queryKey: ["conciliacao-extrato", contaId, dataInicio, dataFim],
    queryFn: () => listarExtratoPersistido({ contaBancariaId: contaId, dataInicio, dataFim }),
    enabled: Boolean(contaId),
  });

  const extratoItems: TransacaoExtrato[] = extratoPersistido
    .filter((t) => t.status !== "ignorado")
    .map((t) => ({
      id: t.fitid,
      data: t.data,
      descricao: t.descricao ?? "",
      valor: Math.abs(Number(t.valor)),
      tipo: Number(t.valor) >= 0 ? "C" : "D",
    }));

  // Índice fitid → sugestão persistida (Motor Inteligente, ondas 3–4).
  const sugestoesPersistidas = new Map<
    string,
    { lancamentoId: string; score: number; motivos: string[] | null }
  >();
  for (const t of extratoPersistido) {
    if (t.status === "pendente" && t.sugestao_lancamento_id && t.sugestao_score != null) {
      sugestoesPersistidas.set(t.fitid, {
        lancamentoId: t.sugestao_lancamento_id,
        score: Number(t.sugestao_score),
        motivos: t.sugestao_motivos,
      });
    }
  }

  // ── Importar extrato OFX ──────────────────────────────────────────────────
  const importarExtrato = useCallback(async (file: File) => {
    if (!contaId) {
      toast.error("Selecione uma conta bancária antes de importar o extrato.");
      return;
    }
    const transacoes = await parseOFX(file);
    const { inseridas } = await persistirExtratoOFX({
      contaBancariaId: contaId,
      transacoes,
    });
    setPares([]);
    queryClient.invalidateQueries({ queryKey: ["conciliacao-extrato", contaId] });
    const duplicadas = transacoes.length - inseridas;
    toast.success(
      duplicadas > 0
        ? `${inseridas} transação(ões) importada(s); ${duplicadas} já existia(m).`
        : `${inseridas} transação(ões) importada(s) do extrato.`,
    );
  }, [contaId, queryClient]);

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

  // ── Aceita sugestões persistidas em lote (Onda 7) ─────────────────────────
  const aceitarSugestoesPersistidas = useCallback((minScore = 0.7): number => {
    const usados = new Set(pares.map((p) => p.lancamentoId));
    const novos: ParConciliacao[] = [];
    for (const [fitid, s] of sugestoesPersistidas.entries()) {
      if (s.score < minScore) continue;
      if (usados.has(s.lancamentoId)) continue;
      if (pares.some((p) => p.extratoId === fitid)) continue;
      novos.push({
        extratoId: fitid,
        lancamentoId: s.lancamentoId,
        origem: "sugestao",
        sugestaoScore: s.score,
      });
      usados.add(s.lancamentoId);
    }
    if (novos.length) {
      setPares((prev) => [...prev, ...novos]);
      toast.success(`${novos.length} sugestão(ões) aceita(s).`);
    }
    return novos.length;
  }, [pares, sugestoesPersistidas]);

  // ── Auto-match por valor e data ───────────────────────────────────────────
  const autoMatch = useCallback(async () => {
    const usados = new Set<string>();
    const novosPares: ParConciliacao[] = [];
    const semMatch: TransacaoExtrato[] = [];

    // Tenta primeiro a RPC com pg_trgm; em falha, usa heurística client.
    try {
      const payload = extratoItems.map((e) => ({
        id: e.id,
        valor: e.valor,
        data: e.data,
        descricao: e.descricao,
      }));
      const ranked = await sugerirConciliacaoBancariaRpc({ contaId, extrato: payload });
      // Para cada extrato, pega o melhor lançamento ainda não usado
      const grouped = new Map<string, Array<{ lancamento_id: string; score: number }>>();
      for (const r of ranked) {
        if (!grouped.has(r.extrato_id)) grouped.set(r.extrato_id, []);
        grouped.get(r.extrato_id)!.push({ lancamento_id: r.lancamento_id, score: Number(r.score) });
      }
      for (const extrato of extratoItems) {
        const cands = (grouped.get(extrato.id) || []).sort((a, b) => b.score - a.score);
        const escolhido = cands.find((c) => !usados.has(c.lancamento_id));
        if (escolhido) {
          novosPares.push({
            extratoId: extrato.id,
            lancamentoId: escolhido.lancamento_id,
            origem: "heuristica",
          });
          usados.add(escolhido.lancamento_id);
        } else {
          semMatch.push(extrato);
        }
      }
    } catch {
      // Fallback: heurística client-side
      for (const extrato of extratoItems) {
        const disponiveis = lancamentos.filter((l) => !usados.has(l.id));
        const sugestao = sugerirConciliacao(extrato, disponiveis);
        if (sugestao) {
          novosPares.push({
            extratoId: extrato.id,
            lancamentoId: sugestao.titulo.id,
            origem: "heuristica",
          });
          usados.add(sugestao.titulo.id);
        } else {
          semMatch.push(extrato);
        }
      }
    }

    // ── Fallback IA: para extratos sem par confiável ───────────────────────
    // Custo controlado: até 5 chamadas por execução, em paralelo.
    let iaSugeridos = 0;
    if (semMatch.length > 0 && lancamentos.length > 0) {
      const candidatosBase = lancamentos.filter((l) => !usados.has(l.id));
      if (candidatosBase.length > 0) {
        const alvos = semMatch.slice(0, 5);
        const resultados = await Promise.allSettled(
          alvos.map((extrato) => sugerirConciliacaoIa(extrato, candidatosBase)),
        );
        for (let i = 0; i < resultados.length; i++) {
          const r = resultados[i];
          if (r.status !== "fulfilled" || !r.value) continue;
          if (usados.has(r.value.titulo.id)) continue;
          novosPares.push({
            extratoId: alvos[i].id,
            lancamentoId: r.value.titulo.id,
            origem: "ia",
            justificativa: r.value.justificativa,
          });
          usados.add(r.value.titulo.id);
          iaSugeridos++;
        }
      }
    }

    setPares(novosPares);
    toast.success(
      iaSugeridos > 0
        ? `${novosPares.length} par(es) encontrado(s) — ${iaSugeridos} sugerido(s) por IA.`
        : `${novosPares.length} par(es) encontrado(s) automaticamente.`,
    );
  }, [extratoItems, lancamentos, contaId]);

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

      // Onda 7 — feedback ao motor de aprendizado (best-effort).
      const persistidoByFitid = new Map(extratoPersistido.map((t) => [t.fitid, t]));
      await Promise.allSettled(
        pares.map((par) => {
          const persistido = persistidoByFitid.get(par.extratoId);
          if (!persistido) return Promise.resolve();
          const sugerido = persistido.sugestao_lancamento_id;
          const acao: "aceito" | "trocado" | "manual" =
            sugerido && sugerido === par.lancamentoId
              ? "aceito"
              : sugerido
                ? "trocado"
                : "manual";
          return registrarFeedbackMatching({
            extrato_importacao_id: persistido.id,
            lancamento_id: par.lancamentoId,
            sugestao_lancamento_id: sugerido,
            sugestao_score: persistido.sugestao_score,
            acao,
          });
        }),
      );
    },
    onSuccess: () => {
      toast.success(`${pares.length} transação(ões) conciliada(s) com sucesso!`);
      setPares([]);
      queryClient.invalidateQueries({
        queryKey: ["conciliacao-lancamentos", contaId],
      });
      queryClient.invalidateQueries({ queryKey: ["conciliacao-extrato", contaId] });
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
      queryClient.invalidateQueries({ queryKey: ["contas_bancarias"] });
    },
    onError: (err) => {
      notifyError(err);
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
    aceitarSugestoesPersistidas,
    sugestoesPersistidas,
    extratoPersistido,
    conciliar: persistirConciliacao,
    conciliando,
  };
}
