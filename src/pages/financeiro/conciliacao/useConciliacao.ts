import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseOFX, type OFXTransaction } from "@/lib/parseOFX";
import {
  calcularScoreConciliacao,
  conciliarTransacao,
  confirmarConciliacao,
  type TituloParaConciliacao,
} from "@/services/financeiro/conciliacao.service";
import type { TransacaoExtrato } from "@/services/financeiro/ofxParser.service";
import {
  listContasBancariasParaConciliacao,
  fetchLancamentosParaConciliacao,
  type ContaBancariaDropdown,
} from "@/services/financeiro/conciliacaoLoaders.service";
import type { Lancamento } from "@/types/domain";
import { notifyError } from "@/utils/errorMessages";
import { getOrigemKey } from "@/lib/financeiro";
import { useIsMobile } from "@/hooks/use-mobile";
import { logger } from "@/lib/logger";
import type { LancamentoComStatus, Match } from "./types";
import { criarLancamentoInlineDoExtrato } from "@/services/financeiro/criarLancamentoInline.service";
import { supabase } from "@/integrations/supabase/client";

/** Threshold de score para conciliação automática em lote. */
const AUTO_SCORE_THRESHOLD = 0.9;

const defaultDataInicio = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split("T")[0];
};
const defaultDataFim = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 0);
  return d.toISOString().split("T")[0];
};

/**
 * Hook orquestrador da página de Conciliação Bancária.
 * Concentra estado, queries, mutations e handlers extraídos da página
 * monolítica na Etapa 6.4. Não altera comportamento — apenas reorganiza.
 */
export function useConciliacao() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();

  const [contasBancarias, setContasBancarias] = useState<ContaBancariaDropdown[]>([]);
  const [selectedConta, setSelectedConta] = useState<string>("");
  const [extratoItems, setExtratoItems] = useState<OFXTransaction[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [loadingLanc, setLoadingLanc] = useState(false);
  const [showOFXPane, setShowOFXPane] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mobile vincular bottom-sheet
  const [vincularOpen, setVincularOpen] = useState(false);
  const [vincularExtratoId, setVincularExtratoId] = useState<string | null>(null);
  const [vincularSearch, setVincularSearch] = useState("");

  // Period filter state
  const [dataInicio, setDataInicio] = useState(searchParams.get("data_inicio") ?? defaultDataInicio());
  const [dataFim, setDataFim] = useState(searchParams.get("data_fim") ?? defaultDataFim());

  // Filter state
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") ?? "");
  const [statusConcFilters, setStatusConcFilters] = useState<string[]>(
    searchParams.get("status") ? searchParams.get("status")!.split(",") : [],
  );
  const [tipoFilters, setTipoFilters] = useState<string[]>(
    searchParams.get("tipo") ? searchParams.get("tipo")!.split(",") : [],
  );
  const [origemFilters, setOrigemFilters] = useState<string[]>([]);

  // Sync filters → URL
  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("data_inicio", dataInicio);
      next.set("data_fim", dataFim);
      if (searchTerm) next.set("search", searchTerm); else next.delete("search");
      if (statusConcFilters.length) next.set("status", statusConcFilters.join(",")); else next.delete("status");
      if (tipoFilters.length) next.set("tipo", tipoFilters.join(",")); else next.delete("tipo");
      return next;
    }, { replace: true });
  }, [dataInicio, dataFim, searchTerm, statusConcFilters, tipoFilters]); // eslint-disable-line react-hooks/exhaustive-deps -- setSearchParams é estável (react-router); evitar incluí-lo previne loop de update

  // Contas bancárias (raramente muda)
  const { data: contasQuery } = useQuery({
    queryKey: ["contas_bancarias", "ativas"],
    queryFn: () => listContasBancariasParaConciliacao(),
    staleTime: Infinity,
  });
  useEffect(() => {
    if (contasQuery) setContasBancarias(contasQuery);
  }, [contasQuery]);

  // Carga de lançamentos
  const loadLancamentosFromPeriod = useCallback(async (from: string, to: string, contaId: string) => {
    if (!contaId) return;
    setLoadingLanc(true);
    try {
      const rows = await fetchLancamentosParaConciliacao(contaId, from, to);
      setLancamentos(rows);
    } finally {
      setLoadingLanc(false);
    }
  }, []);

  useEffect(() => {
    if (selectedConta) {
      loadLancamentosFromPeriod(dataInicio, dataFim, selectedConta);
      setMatches([]);
    } else {
      setLancamentos([]);
    }
  }, [selectedConta, dataInicio, dataFim, loadLancamentosFromPeriod]);

  // OFX upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const text = await file.text();
      const items = parseOFX(text);
      if (items.length === 0) {
        toast.error("Nenhuma transação encontrada no arquivo OFX.");
        return;
      }
      setExtratoItems(items);
      setMatches([]);
      setShowOFXPane(true);
      toast.success(`${items.length} transações importadas do extrato.`);
      if (selectedConta) {
        const dates = items.map((i) => i.data).sort();
        await loadLancamentosFromPeriod(dates[0], dates[dates.length - 1], selectedConta);
      }
    } catch (err: unknown) {
      logger.error("[conciliacao] erro ao processar OFX:", err);
      notifyError(err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleContaChange = async (contaId: string) => {
    setSelectedConta(contaId);
    setMatches([]);
  };

  // Auto-match heurístico + fallback IA
  const handleAutoMatch = async () => {
    const newMatches: Match[] = [];
    const usedLancamentos = new Set<string>();
    const semMatch: typeof extratoItems = [];

    for (const extrato of extratoItems) {
      const candidate = lancamentos.find((l) => {
        if (usedLancamentos.has(l.id)) return false;
        const valorMatch = Math.abs(Math.abs(l.valor) - Math.abs(extrato.valor)) < 0.01;
        if (!valorMatch) return false;
        const extratoDate = new Date(extrato.data);
        const lancDate = new Date(l.data_vencimento);
        const diffDays = Math.abs((extratoDate.getTime() - lancDate.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays <= 3;
      });
      if (candidate) {
        newMatches.push({ extratoId: extrato.id, lancamentoId: candidate.id, origem: "heuristica" });
        usedLancamentos.add(candidate.id);
      } else {
        semMatch.push(extrato);
      }
    }

    let iaCount = 0;
    if (semMatch.length > 0) {
      const disponiveis = lancamentos
        .filter((l) => !usedLancamentos.has(l.id))
        .map((l) => ({
          id: l.id,
          descricao: l.descricao ?? null,
          valor: Math.abs(Number(l.valor)),
          data_vencimento: l.data_vencimento,
          data_baixa: (l as unknown as { data_baixa?: string | null }).data_baixa ?? null,
        }));
      if (disponiveis.length > 0) {
        const { sugerirConciliacaoIaRemota } = await import("@/services/ia/sugestao.service");
        const alvos = semMatch.slice(0, 5);
        const resultados = await Promise.allSettled(
          alvos.map((e) =>
            sugerirConciliacaoIaRemota({
              transacao: { id: e.id, descricao: e.descricao, valor: e.valor, data: e.data },
              candidatos: disponiveis,
            }),
          ),
        );
        for (let i = 0; i < resultados.length; i++) {
          const r = resultados[i];
          if (r.status !== "fulfilled" || !r.value.lancamento_id) continue;
          if (usedLancamentos.has(r.value.lancamento_id)) continue;
          newMatches.push({
            extratoId: alvos[i].id,
            lancamentoId: r.value.lancamento_id,
            origem: "ia",
            justificativa: r.value.justificativa,
          });
          usedLancamentos.add(r.value.lancamento_id);
          iaCount++;
        }
      }
    }

    setMatches(newMatches);
    toast.success(
      iaCount > 0
        ? `${newMatches.length} pares encontrados — ${iaCount} sugerido(s) por IA.`
        : `${newMatches.length} pares encontrados automaticamente.`,
    );
  };

  const handleManualMatch = (extratoId: string, lancamentoId: string) => {
    setMatches((prev) => {
      const filtered = prev.filter((m) => m.extratoId !== extratoId);
      if (lancamentoId === "") return filtered;
      return [...filtered, { extratoId, lancamentoId }];
    });
  };

  /**
   * Épico D — Cria um lançamento novo diretamente a partir de uma
   * transação sem par no extrato, já baixado na conta selecionada,
   * e adiciona o match automaticamente.
   */
  const handleCriarLancamentoInline = useCallback(async (extratoId: string) => {
    const extrato = extratoItems.find((e) => e.id === extratoId);
    if (!extrato) return;
    if (!selectedConta) {
      toast.error("Selecione uma conta bancária antes de criar o lançamento.");
      return;
    }
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (!userId) throw new Error("Sessão expirada.");
      const { data: ue } = await supabase
        .from("user_empresas")
        .select("empresa_id")
        .eq("user_id", userId)
        .maybeSingle();
      const empresaId = ue?.empresa_id;
      if (!empresaId) throw new Error("Empresa não identificada.");
      const res = await criarLancamentoInlineDoExtrato({
        empresa_id: empresaId,
        conta_bancaria_id: selectedConta,
        extrato: {
          id: extrato.id,
          data: extrato.data,
          descricao: extrato.descricao ?? "",
          valor: extrato.valor,
          tipo: extrato.valor >= 0 ? "C" : "D",
        },
      });
      setMatches((prev) => [
        ...prev.filter((m) => m.extratoId !== extratoId),
        { extratoId, lancamentoId: res.lancamento_id, origem: "inline" },
      ]);
      await loadLancamentosFromPeriod(dataInicio, dataFim, selectedConta);
      toast.success(
        res.hint_aplicado
          ? "Lançamento criado e baixado (fornecedor/conta sugeridos por regra)."
          : "Lançamento criado e baixado automaticamente.",
      );
    } catch (err) {
      notifyError(err);
    }
  }, [extratoItems, selectedConta, dataInicio, dataFim, loadLancamentosFromPeriod]);

  // Conciliação automática em lote (score ≥ AUTO_SCORE_THRESHOLD)
  const handleConciliacaoAutomatica = useCallback(() => {
    const newMatches: Match[] = [];
    const usedLancamentos = new Set<string>();

    for (const extrato of extratoItems) {
      const transacao: TransacaoExtrato = {
        id: extrato.id,
        data: extrato.data,
        descricao: extrato.descricao ?? "",
        valor: Math.abs(extrato.valor),
        tipo: extrato.valor >= 0 ? "C" : "D",
      };

      let melhorScore = -1;
      let melhorTitulo: Lancamento | null = null;

      for (const l of lancamentos) {
        if (usedLancamentos.has(l.id)) continue;
        const titulo: TituloParaConciliacao = {
          id: l.id,
          descricao: l.descricao,
          valor: l.valor,
          data_vencimento: l.data_vencimento,
          tipo: l.tipo,
          status: l.status,
          data_baixa: (l as Lancamento & { data_baixa?: string | null }).data_baixa ?? null,
        };
        const score = calcularScoreConciliacao(transacao, titulo);
        if (score > melhorScore) {
          melhorScore = score;
          melhorTitulo = l;
        }
      }

      if (melhorScore >= AUTO_SCORE_THRESHOLD && melhorTitulo) {
        newMatches.push({ extratoId: extrato.id, lancamentoId: melhorTitulo.id });
        usedLancamentos.add(melhorTitulo.id);
      }
    }

    setMatches((prev) => {
      const manual = prev.filter((m) => !newMatches.some((nm) => nm.extratoId === m.extratoId));
      return [...manual, ...newMatches];
    });

    toast.success(
      `${newMatches.length} transação(ões) conciliada(s) automaticamente (score ≥ ${AUTO_SCORE_THRESHOLD}).`,
    );
  }, [extratoItems, lancamentos]);

  // Confirmar
  const handleConfirmarConciliacao = async () => {
    if (matches.length === 0) {
      toast.error("Nenhum par confirmado para conciliar.");
      return;
    }
    const payload = {
      conta_bancaria_id: selectedConta,
      data_conciliacao: new Date().toISOString(),
      pares: matches.map((m) => {
        const extrato = extratoItems.find((e) => e.id === m.extratoId);
        const lancamento = lancamentos.find((l) => l.id === m.lancamentoId);
        return {
          extrato_id: m.extratoId,
          lancamento_id: m.lancamentoId,
          valor_extrato: extrato?.valor ?? null,
          valor_lancamento: lancamento?.valor ?? null,
        };
      }),
    };

    setConfirming(true);
    try {
      await Promise.all(
        payload.pares.map((par) => {
          const extrato = extratoItems.find((e) => e.id === par.extrato_id);
          if (!extrato) return Promise.resolve();
          const transacao: TransacaoExtrato = {
            id: extrato.id,
            data: extrato.data,
            descricao: extrato.descricao,
            valor: extrato.valor,
            tipo: extrato.valor >= 0 ? "C" : "D",
          };
          return conciliarTransacao(selectedConta, transacao, par.lancamento_id);
        }),
      );
      try {
        await confirmarConciliacao({
          conta_bancaria_id: selectedConta,
          data_conciliacao: new Date().toISOString(),
          pares: payload.pares,
          usuario_id: undefined,
        });
      } catch {
        // Silently fail if tables don't exist yet
      }
      const pareados = matches.length;
      const semPar = extratoItems.length - pareados;
      toast.success(
        `${pareados} transação(ões) conciliada(s) com sucesso! ${semPar} sem correspondência.`,
      );
      setMatches([]);
    } catch (err) {
      notifyError(err);
    } finally {
      setConfirming(false);
    }
  };

  // Derivados
  const getMatch = (extratoId: string) => matches.find((m) => m.extratoId === extratoId);
  const usedLancamentoIds = new Set(matches.map((m) => m.lancamentoId));

  const pareados = matches.length;
  const semParOFX = extratoItems.length - pareados;
  const pendentesERP = lancamentos.length - pareados;

  const lancamentosComStatus = useMemo((): LancamentoComStatus[] => {
    return lancamentos.map((l) => {
      const match = matches.find((m) => m.lancamentoId === l.id);
      const extratoItem = match ? extratoItems.find((e) => e.id === match.extratoId) : null;
      let statusConciliacao = "pendente";
      let divergencia: number | null = null;
      if (match && extratoItem) {
        const diff = Math.abs(Math.abs(l.valor) - Math.abs(extratoItem.valor));
        if (diff < 0.01) statusConciliacao = "conciliado";
        else { statusConciliacao = "divergente"; divergencia = diff; }
      }
      return { ...l, statusConciliacao, extratoId: match?.extratoId ?? null, divergencia };
    });
  }, [lancamentos, matches, extratoItems]);

  const filteredData = useMemo(() => {
    return lancamentosComStatus.filter((l) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (
          !l.descricao?.toLowerCase().includes(term) &&
          !l.tipo?.toLowerCase().includes(term) &&
          !l.status?.toLowerCase().includes(term) &&
          !l.forma_pagamento?.toLowerCase().includes(term)
        ) return false;
      }
      if (statusConcFilters.length > 0 && !statusConcFilters.includes(l.statusConciliacao)) return false;
      if (tipoFilters.length > 0 && !tipoFilters.includes(l.tipo)) return false;
      if (origemFilters.length > 0) {
        const key = getOrigemKey(l);
        if (!origemFilters.includes(key)) return false;
      }
      return true;
    });
  }, [lancamentosComStatus, searchTerm, statusConcFilters, tipoFilters, origemFilters]);

  const handleRemoveFilter = (key: string) => {
    if (key === "statusConc") setStatusConcFilters([]);
    if (key === "tipo") setTipoFilters([]);
    if (key === "origem") setOrigemFilters([]);
  };

  const handleClearAll = () => {
    setStatusConcFilters([]);
    setTipoFilters([]);
    setOrigemFilters([]);
  };

  return {
    isMobile,
    // estado bruto
    contasBancarias, selectedConta, extratoItems, lancamentos, matches,
    uploading, confirming, loadingLanc, showOFXPane, setShowOFXPane,
    fileInputRef,
    // mobile sheet
    vincularOpen, setVincularOpen,
    vincularExtratoId, setVincularExtratoId,
    vincularSearch, setVincularSearch,
    // filtros
    dataInicio, setDataInicio, dataFim, setDataFim,
    searchTerm, setSearchTerm,
    statusConcFilters, setStatusConcFilters,
    tipoFilters, setTipoFilters,
    origemFilters, setOrigemFilters,
    handleRemoveFilter, handleClearAll,
    // derivados
    lancamentosComStatus, filteredData,
    pareados, semParOFX, pendentesERP,
    usedLancamentoIds, getMatch,
    // handlers
    handleFileSelect, handleContaChange,
    handleAutoMatch, handleManualMatch,
    handleConciliacaoAutomatica, handleConfirmarConciliacao,
    handleCriarLancamentoInline,
    setMatches,
  };
}