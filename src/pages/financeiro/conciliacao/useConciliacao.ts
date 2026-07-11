import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseOFXFile, type OFXTransaction } from "@/lib/parseOFX";
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
import type { ConciliacaoPersistida, LancamentoComStatus, Match, SugestaoPersistida } from "./types";
import { criarLancamentoInlineDoExtrato } from "@/services/financeiro/criarLancamentoInline.service";
import { supabase } from "@/integrations/supabase/client";
import { importarDocumentoUniversal } from "@/services/financeiro/importacao/importarDocumento.service";
import {
  desfazerConciliacaoExtrato,
  excluirExtratosPorFitids,
  limparSugestaoExtrato,
  listarExtratoPersistido,
  mapBaixasParaLancamentos,
  marcarExtratoConciliadoPorFitid,
  persistirExtratoOFX,
  criarLoteImportacao,
  atualizarLoteInseridas,
} from "@/services/financeiro/extratoImportacoes.service";
import { registrarFeedbackMatching, type AcaoFeedback } from "@/services/financeiro/matching/feedback.service";
import { registrarAuditoriaConciliacao } from "@/services/financeiro/conciliacaoAuditoria.service";
import { gerarLancamentoAjusteBancario } from "@/services/financeiro/ajusteBancario.service";

/** Threshold de score para conciliação automática em lote. */
const AUTO_SCORE_THRESHOLD = 0.9;
const SUGESTAO_SCORE_THRESHOLD = 0.7;
const CONCILIACAO_LAST_CONTA_KEY = "conciliacao:bancaria:lastConta";
const CONCILIACAO_LAST_DATA_INICIO_KEY = "conciliacao:bancaria:lastDataInicio";
const CONCILIACAO_LAST_DATA_FIM_KEY = "conciliacao:bancaria:lastDataFim";

function getLocalPreference(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setLocalPreference(key: string, value: string): void {
  try {
    if (typeof window === "undefined") return;
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    // Preferência local indisponível — sem impacto funcional.
  }
}

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
  const [selectedConta, setSelectedConta] = useState<string>(() => {
    const urlConta = searchParams.get("conta");
    if (urlConta) return urlConta;
    return getLocalPreference(CONCILIACAO_LAST_CONTA_KEY) ?? "";
  });
  const [extratoItems, setExtratoItems] = useState<OFXTransaction[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [sugestoesPersistidas, setSugestoesPersistidas] = useState<Map<string, SugestaoPersistida>>(new Map());
  const [conciliadosPersistidos, setConciliadosPersistidos] = useState<Map<string, ConciliacaoPersistida>>(new Map());
  // Sprint 1 — lançamentos ERP já conciliados (via baixa persistida)
  const [lancamentosConciliadosIds, setLancamentosConciliadosIds] = useState<Set<string>>(new Set());
  // Sprint 1 — filtro "Exibir apenas pendentes" (aplica a grade e ao painel OFX)
  const [showOnlyPendentes, setShowOnlyPendentes] = useState<boolean>(false);
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
  const [dataInicio, setDataInicio] = useState(
    searchParams.get("data_inicio") ?? getLocalPreference(CONCILIACAO_LAST_DATA_INICIO_KEY) ?? defaultDataInicio(),
  );
  const [dataFim, setDataFim] = useState(
    searchParams.get("data_fim") ?? getLocalPreference(CONCILIACAO_LAST_DATA_FIM_KEY) ?? defaultDataFim(),
  );

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
      if (selectedConta) next.set("conta", selectedConta); else next.delete("conta");
      next.set("data_inicio", dataInicio);
      next.set("data_fim", dataFim);
      if (searchTerm) next.set("search", searchTerm); else next.delete("search");
      if (statusConcFilters.length) next.set("status", statusConcFilters.join(",")); else next.delete("status");
      if (tipoFilters.length) next.set("tipo", tipoFilters.join(",")); else next.delete("tipo");
      return next;
    }, { replace: true });
  }, [selectedConta, dataInicio, dataFim, searchTerm, statusConcFilters, tipoFilters]); // eslint-disable-line react-hooks/exhaustive-deps -- setSearchParams é estável (react-router); evitar incluí-lo previne loop de update

  // Contas bancárias (raramente muda)
  const { data: contasQuery } = useQuery({
    queryKey: ["contas_bancarias", "ativas"],
    queryFn: () => listContasBancariasParaConciliacao(),
    staleTime: Infinity,
  });
  useEffect(() => {
    if (!contasQuery) return;
    setContasBancarias(contasQuery);
    if (selectedConta && !contasQuery.some((c) => c.id === selectedConta)) {
      setSelectedConta("");
    }
  }, [contasQuery]);

  useEffect(() => {
    setLocalPreference(CONCILIACAO_LAST_CONTA_KEY, selectedConta);
  }, [selectedConta]);

  useEffect(() => {
    setLocalPreference(CONCILIACAO_LAST_DATA_INICIO_KEY, dataInicio);
    setLocalPreference(CONCILIACAO_LAST_DATA_FIM_KEY, dataFim);
  }, [dataFim, dataInicio]);

  // Carga de lançamentos
  const loadLancamentosFromPeriod = useCallback(async (from: string, to: string, contaId: string) => {
    setLoadingLanc(true);
    try {
      const rows = await fetchLancamentosParaConciliacao(contaId || null, from, to);
      setLancamentos(rows);
    } finally {
      setLoadingLanc(false);
    }
  }, []);

  const loadSugestoesPersistidas = useCallback(async (items: OFXTransaction[], contaId: string) => {
    if (!contaId || items.length === 0) {
      setSugestoesPersistidas(new Map());
      setConciliadosPersistidos(new Map());
      setLancamentosConciliadosIds(new Set());
      return { conciliados: 0, sugestoes: 0 };
    }
    const datas = items.map((i) => i.data).sort();
    try {
      const rows = await listarExtratoPersistido({
        contaBancariaId: contaId,
        dataInicio: datas[0],
        dataFim: datas[datas.length - 1],
      });
      const fitidsAtuais = new Set(items.map((i) => i.id));
      const next = new Map<string, SugestaoPersistida>();
      const conciliados = new Map<string, ConciliacaoPersistida>();
      rows.forEach((row) => {
        if (!fitidsAtuais.has(row.fitid)) return;
        if (row.status === "conciliado") {
          conciliados.set(row.fitid, {
            extratoPersistidoId: row.id,
            baixaId: row.baixa_id,
          });
          return;
        }
        if (
          row.status === "pendente" &&
          row.sugestao_lancamento_id &&
          row.sugestao_score != null
        ) {
          next.set(row.fitid, {
            extratoPersistidoId: row.id,
            lancamentoId: row.sugestao_lancamento_id,
            score: Number(row.sugestao_score),
            motivos: row.sugestao_motivos,
          });
        }
      });
      setSugestoesPersistidas(next);
      setConciliadosPersistidos(conciliados);
      // Cruza baixa_id → lancamento_id para marcar linhas conciliadas na grade ERP.
      const baixaIds = Array.from(conciliados.values())
        .map((c) => c.baixaId)
        .filter((v): v is string => !!v);
      if (baixaIds.length > 0) {
        try {
          const mapa = await mapBaixasParaLancamentos(baixaIds);
          setLancamentosConciliadosIds(new Set(mapa.values()));
        } catch (err) {
          logger.warn("[conciliacao] falha ao mapear baixas→lançamentos:", err);
          setLancamentosConciliadosIds(new Set());
        }
      } else {
        setLancamentosConciliadosIds(new Set());
      }
      return { conciliados: conciliados.size, sugestoes: next.size };
    } catch (err) {
      logger.warn("[conciliacao] falha ao carregar sugestões persistidas:", err);
      setSugestoesPersistidas(new Map());
      setConciliadosPersistidos(new Map());
      setLancamentosConciliadosIds(new Set());
      return { conciliados: 0, sugestoes: 0 };
    }
  }, []);

  const obterSessaoEmpresa = useCallback(async (): Promise<{ empresaId: string; userId: string } | null> => {
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) return null;
    const { data: ue } = await supabase
      .from("user_empresas")
      .select("empresa_id")
      .eq("user_id", userId)
      .maybeSingle();
    return ue?.empresa_id ? { empresaId: ue.empresa_id, userId } : null;
  }, []);

  const hydrateExtratoPersistido = useCallback(async (input: {
    contaId: string;
    from: string;
    to: string;
  }): Promise<OFXTransaction[]> => {
    if (!input.contaId) {
      setExtratoItems([]);
      setSugestoesPersistidas(new Map());
      setConciliadosPersistidos(new Map());
      setLancamentosConciliadosIds(new Set());
      return [];
    }
    const rows = await listarExtratoPersistido({
      contaBancariaId: input.contaId,
      dataInicio: input.from,
      dataFim: input.to,
    });
    const items: OFXTransaction[] = rows.map((r) => ({
      id: r.fitid,
      data: r.data,
      valor: Number(r.valor),
      descricao: r.descricao ?? "",
    }));
    setExtratoItems(items);
    if (items.length > 0) setShowOFXPane(true);
    await loadSugestoesPersistidas(items, input.contaId);
    return items;
  }, [loadSugestoesPersistidas]);

  const registrarFeedbackSugestao = useCallback((input: {
    extratoId: string;
    acao: AcaoFeedback;
    escolhaFinalLancamentoId?: string | null;
    motivo?: string | null;
  }) => {
    const sugestao = sugestoesPersistidas.get(input.extratoId);
    if (!sugestao) return;
    void (async () => {
      try {
        const sessao = await obterSessaoEmpresa();
        if (!sessao) return;
        await registrarFeedbackMatching({
          empresa_id: sessao.empresaId,
          usuario_id: sessao.userId,
          extrato_id: sugestao.extratoPersistidoId,
          sugestao_lancamento_id: sugestao.lancamentoId,
          sugestao_score: sugestao.score,
          escolha_final_lancamento_id: input.escolhaFinalLancamentoId ?? null,
          acao: input.acao,
          motivo: input.motivo ?? null,
        });
      } catch (err) {
        logger.warn("[conciliacao] falha ao registrar feedback de matching:", err);
      }
    })();
  }, [obterSessaoEmpresa, sugestoesPersistidas]);

  useEffect(() => {
    loadLancamentosFromPeriod(dataInicio, dataFim, selectedConta);
    setMatches([]);
    setSugestoesPersistidas(new Map());
    setConciliadosPersistidos(new Map());
    setLancamentosConciliadosIds(new Set());
    // Hidrata extrato persistido do banco para a conta/período —
    // extratos importados permanecem visíveis ao trocar de conta,
    // filtrar período ou recarregar a página.
    if (!selectedConta) {
      setExtratoItems([]);
      return;
    }
    void (async () => {
      try {
        await hydrateExtratoPersistido({ contaId: selectedConta, from: dataInicio, to: dataFim });
      } catch (err) {
        logger.warn("[conciliacao] falha ao hidratar extrato persistido:", err);
        setExtratoItems([]);
      }
    })();
  }, [selectedConta, dataInicio, dataFim, loadLancamentosFromPeriod, hydrateExtratoPersistido]);

  const handleExcluirExtratosSelecionados = useCallback(async (fitids: string[]): Promise<number> => {
    if (!selectedConta || fitids.length === 0) return 0;
    const conciliadosNoLote = fitids.filter((id) => conciliadosPersistidos.has(id)).length;
    const confirmar = window.confirm(
      conciliadosNoLote > 0
        ? `${conciliadosNoLote} das ${fitids.length} linhas selecionadas já estão conciliadas e serão preservadas. Excluir as demais?`
        : `Excluir ${fitids.length} linha(s) do extrato importado? Esta ação não pode ser desfeita.`,
    );
    if (!confirmar) return 0;
    try {
      const res = await excluirExtratosPorFitids({ contaBancariaId: selectedConta, fitids });
      const removidos = new Set(fitids.filter((id) => !conciliadosPersistidos.has(id)));
      setExtratoItems((prev) => prev.filter((i) => !removidos.has(i.id)));
      setMatches((prev) => prev.filter((m) => !removidos.has(m.extratoId)));
      setSugestoesPersistidas((prev) => {
        const next = new Map(prev);
        removidos.forEach((id) => next.delete(id));
        return next;
      });
      toast.success(`${res.excluidas} linha(s) excluída(s) do extrato.`);
      return res.excluidas;
    } catch (err) {
      notifyError(err);
      return 0;
    }
  }, [conciliadosPersistidos, selectedConta]);

  // OFX upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const nome = file.name.toLowerCase();
      const isOFX = nome.endsWith(".ofx") || nome.endsWith(".qfx") || nome.endsWith(".xml");
      if (isOFX) {
        const items = await parseOFXFile(file);
        if (items.length === 0) {
          toast.error("Nenhuma transação encontrada no arquivo OFX.");
          return;
        }
        if (!selectedConta) {
          toast.error("Selecione uma conta bancária antes de importar o OFX.");
          return;
        }
        setExtratoItems(items);
        setMatches([]);
        setShowOFXPane(true);
        const dates = items.map((i) => i.data).sort();
        const importInicio = dates[0];
        const importFim = dates[dates.length - 1];
        if (importInicio && importFim && (importInicio !== dataInicio || importFim !== dataFim)) {
          setDataInicio(importInicio);
          setDataFim(importFim);
        }
        if (selectedConta) {
          await loadLancamentosFromPeriod(importInicio, importFim, selectedConta);
        }
        const sessaoImportacao = await obterSessaoEmpresa();
        const loteId = sessaoImportacao?.empresaId
          ? await criarLoteImportacao({
              empresaId: sessaoImportacao.empresaId,
              contaBancariaId: selectedConta,
              arquivoNome: file.name,
              origem: "ofx",
              totalTransacoes: items.length,
              criadoPor: sessaoImportacao.userId,
            }).catch((err) => {
              logger.warn("[conciliacao] falha ao criar lote:", err);
              return null;
            })
          : null;
        const persistencia = await persistirExtratoOFX({
          contaBancariaId: selectedConta,
          empresaId: sessaoImportacao?.empresaId,
          loteId,
          transacoes: items.map((i) => ({
            id: i.id,
            data: i.data,
            valor: i.valor,
            descricao: i.descricao,
            tipo: i.valor >= 0 ? "C" : "D",
          })),
        });
        if (loteId) {
          void atualizarLoteInseridas(loteId, persistencia.inseridas).catch(() => undefined);
        }
        if (sessaoImportacao) {
          void registrarAuditoriaConciliacao({
            empresaId: sessaoImportacao.empresaId,
            usuarioId: sessaoImportacao.userId,
            acao: "importacao",
            entidade: "financeiro_extrato_lotes",
            entidadeId: loteId,
            payload: {
              arquivo: file.name,
              total: items.length,
              inseridas: persistencia.inseridas,
              conta_bancaria_id: selectedConta,
            },
          });
        }
        const duplicadasPersistidas = Math.max(0, items.length - persistencia.inseridas);
        toast.success(
          duplicadasPersistidas > 0
            ? `${persistencia.inseridas} transação(ões) nova(s); ${duplicadasPersistidas} já estavam salvas.`
            : `${items.length} transações importadas e salvas.`,
        );
        await hydrateExtratoPersistido({ contaId: selectedConta, from: importInicio, to: importFim });
        // Onda 7 — também persiste o OFX no Motor Universal para gerar
        // sugestões (best-effort; falha silenciosa não bloqueia a UI).
        if (selectedConta) {
          try {
            const ue = sessaoImportacao ? { empresa_id: sessaoImportacao.empresaId } : null;
            if (ue?.empresa_id) {
              const res = await importarDocumentoUniversal({
                file,
                empresa_id: ue.empresa_id,
                conta_bancaria_id: selectedConta,
              });
              if (res.com_sugestao > 0) {
                toast.info(`${res.com_sugestao} sugestão(ões) automáticas geradas.`);
              }
              const duplicadas = Math.max(0, (res.total ?? items.length) - (res.inseridas ?? 0));
              if (duplicadas > 0) {
                toast.info(
                  `${duplicadas} transação(ões) já haviam sido importadas anteriormente (ignoradas).`,
                );
              }
              await hydrateExtratoPersistido({ contaId: selectedConta, from: importInicio, to: importFim });
              const meta = await loadSugestoesPersistidas(items, selectedConta);
              if (meta && meta.conciliados > 0) {
                toast.info(
                  `${meta.conciliados} transação(ões) já conciliadas em sessões anteriores foram ocultadas.`,
                );
              }
            }
          } catch (persistErr) {
            logger.warn("[conciliacao] motor universal falhou (best-effort):", persistErr);
          }
        }
      } else {
        // Motor Universal (PDF/CSV) — grava no banco e recarrega
        if (!selectedConta) {
          toast.error("Selecione uma conta bancária antes de importar PDF/CSV.");
          return;
        }
        const empresaId = (await obterSessaoEmpresa())?.empresaId;
        if (!empresaId) throw new Error("Empresa não identificada.");
        const res = await importarDocumentoUniversal({
          file,
          empresa_id: empresaId,
          conta_bancaria_id: selectedConta,
        });
        toast.success(
          `${res.inseridas} de ${res.total} transações importadas (${res.origem}) — ${res.com_sugestao} com sugestão automática.`,
        );
        const duplicadas = Math.max(0, (res.total ?? 0) - (res.inseridas ?? 0));
        if (duplicadas > 0) {
          toast.info(
            `${duplicadas} transação(ões) já haviam sido importadas anteriormente (ignoradas).`,
          );
        }
        await hydrateExtratoPersistido({ contaId: selectedConta, from: dataInicio, to: dataFim });
      }
    } catch (err: unknown) {
      logger.error("[conciliacao] erro ao processar OFX:", err);
      notifyError(err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAceitarSugestao = useCallback((extratoId: string): boolean => {
    const sugestao = sugestoesPersistidas.get(extratoId);
    if (!sugestao) {
      toast.error("Sugestão não encontrada para esta transação.");
      return false;
    }
    const usados = new Set(matches.map((m) => m.lancamentoId));
    if (usados.has(sugestao.lancamentoId)) {
      toast.error("O lançamento sugerido já está pareado.");
      return false;
    }
    setMatches((prev) => [
      ...prev.filter((m) => m.extratoId !== extratoId && m.lancamentoId !== sugestao.lancamentoId),
      {
        extratoId,
        lancamentoId: sugestao.lancamentoId,
        origem: "sugestao",
        sugestaoScore: sugestao.score,
        sugestaoMotivos: sugestao.motivos,
      },
    ]);
    registrarFeedbackSugestao({
      extratoId,
      acao: "aceita",
      escolhaFinalLancamentoId: sugestao.lancamentoId,
      motivo: "Sugestão persistida aceita na conciliação OFX.",
    });
    toast.success("Sugestão aceita.");
    return true;
  }, [matches, registrarFeedbackSugestao, sugestoesPersistidas]);

  const handleAceitarSugestoesPersistidas = useCallback((minScore = SUGESTAO_SCORE_THRESHOLD): number => {
    const jaPareados = new Set(matches.map((m) => m.extratoId));
    const usados = new Set(matches.map((m) => m.lancamentoId));
    const novos: Match[] = [];

    for (const item of extratoItems) {
      if (jaPareados.has(item.id)) continue;
      const sugestao = sugestoesPersistidas.get(item.id);
      if (!sugestao || sugestao.score < minScore || usados.has(sugestao.lancamentoId)) continue;
      novos.push({
        extratoId: item.id,
        lancamentoId: sugestao.lancamentoId,
        origem: "sugestao",
        sugestaoScore: sugestao.score,
        sugestaoMotivos: sugestao.motivos,
      });
      usados.add(sugestao.lancamentoId);
    }

    if (novos.length === 0) {
      toast.info("Nenhuma sugestão disponível para aceitar.");
      return 0;
    }
    setMatches((prev) => [...prev, ...novos]);
    novos.forEach((match) => {
      registrarFeedbackSugestao({
        extratoId: match.extratoId,
        acao: "aceita",
        escolhaFinalLancamentoId: match.lancamentoId,
        motivo: "Sugestão persistida aceita em lote na conciliação OFX.",
      });
    });
    toast.success(`${novos.length} sugestão(ões) aceita(s).`);
    return novos.length;
  }, [extratoItems, matches, registrarFeedbackSugestao, sugestoesPersistidas]);

  const handleRejeitarSugestao = useCallback((extratoId: string): boolean => {
    const sugestao = sugestoesPersistidas.get(extratoId);
    if (!sugestao) {
      toast.error("Sugestão não encontrada para esta transação.");
      return false;
    }
    registrarFeedbackSugestao({
      extratoId,
      acao: "rejeitada",
      escolhaFinalLancamentoId: null,
      motivo: "Sugestão persistida rejeitada na conciliação OFX.",
    });
    void limparSugestaoExtrato(sugestao.extratoPersistidoId).catch((err) => {
      logger.warn("[conciliacao] falha ao limpar sugestão rejeitada:", err);
    });
    setSugestoesPersistidas((prev) => {
      const next = new Map(prev);
      next.delete(extratoId);
      return next;
    });
    toast.success("Sugestão rejeitada.");
    return true;
  }, [registrarFeedbackSugestao, sugestoesPersistidas]);

  /**
   * Onda 10 — Desfaz uma conciliação persistida a partir do fitid do
   * extrato: estorna a baixa vinculada, reabre o extrato e recarrega
   * lançamentos para refletir o novo saldo em aberto.
   */
  const handleDesfazerConciliacaoPersistida = useCallback(async (extratoId: string): Promise<boolean> => {
    const conc = conciliadosPersistidos.get(extratoId);
    if (!conc) {
      toast.error("Esta transação não está conciliada.");
      return false;
    }
    const confirmar = window.confirm(
      "Desfazer a conciliação irá estornar a baixa financeira vinculada. Continuar?",
    );
    if (!confirmar) return false;
    try {
      await desfazerConciliacaoExtrato({
        extratoPersistidoId: conc.extratoPersistidoId,
        baixaId: conc.baixaId,
        motivo: "Conciliação bancária desfeita pelo usuário.",
      });
      void (async () => {
        const s = await obterSessaoEmpresa();
        if (!s) return;
        registrarAuditoriaConciliacao({
          empresaId: s.empresaId,
          usuarioId: s.userId,
          acao: "estorno",
          entidade: "financeiro_extrato_importacoes",
          entidadeId: conc.extratoPersistidoId,
          payload: { baixa_id: conc.baixaId, fitid: extratoId },
        });
      })();
      setConciliadosPersistidos((prev) => {
        const next = new Map(prev);
        next.delete(extratoId);
        return next;
      });
      await loadLancamentosFromPeriod(dataInicio, dataFim, selectedConta);
      toast.success("Conciliação desfeita. A baixa foi estornada.");
      return true;
    } catch (err) {
      notifyError(err);
      return false;
    }
  }, [conciliadosPersistidos, dataFim, dataInicio, loadLancamentosFromPeriod, selectedConta]);

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
    const sugestao = sugestoesPersistidas.get(extratoId);
    if (sugestao && lancamentoId) {
      registrarFeedbackSugestao({
        extratoId,
        acao: sugestao.lancamentoId === lancamentoId ? "aceita" : "corrigida",
        escolhaFinalLancamentoId: lancamentoId,
        motivo: sugestao.lancamentoId === lancamentoId
          ? "Sugestão persistida escolhida via pareamento manual."
          : "Sugestão persistida corrigida via pareamento manual.",
      });
    }
    setMatches((prev) => {
      const filtered = prev.filter((m) => m.extratoId !== extratoId);
      if (lancamentoId === "") return filtered;
      return [...filtered, { extratoId, lancamentoId }];
    });
  };

  /**
   * Estilo TOTVS: confirma um "lote" de pareamento a partir de linhas
   * marcadas via checkbox em cada painel. Suporta:
   *  - 1↔1: pareamento direto.
   *  - N↔1: várias linhas do extrato → um lançamento (ex.: parcelas do mesmo título).
   *  - 1↔N: uma linha do extrato → vários lançamentos (ex.: crédito agrupando títulos).
   *  - N↔N não é permitido (ambíguo); usuário deve conciliar em passos.
   */
  const handleConfirmarSelecao = useCallback(
    (extratoIds: string[], lancamentoIds: string[]): boolean => {
      if (extratoIds.length === 0 || lancamentoIds.length === 0) {
        toast.error("Selecione ao menos uma linha em cada lado.");
        return false;
      }
      if (extratoIds.length > 1 && lancamentoIds.length > 1) {
        toast.error(
          "Seleção N↔N não é permitida. Marque apenas um lado com múltiplas linhas.",
        );
        return false;
      }
      const novos: Match[] = [];
      if (extratoIds.length === 1) {
        const eid = extratoIds[0];
        for (const lid of lancamentoIds) novos.push({ extratoId: eid, lancamentoId: lid, origem: "manual" });
      } else {
        const lid = lancamentoIds[0];
        for (const eid of extratoIds) novos.push({ extratoId: eid, lancamentoId: lid, origem: "manual" });
      }

      novos.forEach((match) => {
        const sugestao = sugestoesPersistidas.get(match.extratoId);
        if (!sugestao) return;
        registrarFeedbackSugestao({
          extratoId: match.extratoId,
          acao: sugestao.lancamentoId === match.lancamentoId ? "aceita" : "corrigida",
          escolhaFinalLancamentoId: match.lancamentoId,
          motivo: "Sugestão persistida revisada via seleção múltipla.",
        });
      });

      setMatches((prev) => {
        // Remove pares existentes envolvendo qualquer id selecionado.
        const limpo = prev.filter(
          (m) => !extratoIds.includes(m.extratoId) && !lancamentoIds.includes(m.lancamentoId),
        );
        return [...limpo, ...novos];
      });
      toast.success(
        `Pareamento confirmado: ${extratoIds.length} extrato(s) ↔ ${lancamentoIds.length} lançamento(s).`,
      );
      return true;
    },
    [registrarFeedbackSugestao, sugestoesPersistidas],
  );

  const handleDesvincularExtrato = useCallback((extratoId: string) => {
    setMatches((prev) => prev.filter((m) => m.extratoId !== extratoId));
  }, []);

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
      if (sugestoesPersistidas.has(extratoId)) {
        registrarFeedbackSugestao({
          extratoId,
          acao: "criada_inline",
          escolhaFinalLancamentoId: res.lancamento_id,
          motivo: "Lançamento criado inline em vez de aceitar a sugestão persistida.",
        });
      }
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
  }, [extratoItems, selectedConta, dataInicio, dataFim, loadLancamentosFromPeriod, registrarFeedbackSugestao, sugestoesPersistidas]);

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
          return conciliarTransacao(selectedConta, transacao, par.lancamento_id)
            .then((baixaId) => marcarExtratoConciliadoPorFitid({
              contaBancariaId: selectedConta,
              fitid: extrato.id,
              baixaId,
            }))
            .catch((err) => {
              logger.warn("[conciliacao] falha ao persistir status do extrato conciliado:", err);
              throw err;
            });
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
      setSugestoesPersistidas((prev) => {
        const next = new Map(prev);
        payload.pares.forEach((par) => next.delete(par.extrato_id));
        return next;
      });
      setMatches([]);
      void (async () => {
        const s = await obterSessaoEmpresa();
        if (!s) return;
        registrarAuditoriaConciliacao({
          empresaId: s.empresaId,
          usuarioId: s.userId,
          acao: "conciliacao",
          entidade: "conciliacao_lote",
          payload: { pares: payload.pares.length, conta_bancaria_id: selectedConta },
        });
      })();
      // Reidrata estado após efetivar as baixas para que:
      //  - lançamentos recém-baixados apareçam como conciliados (via eixo baixa);
      //  - extrato importado mantenha as linhas conciliadas visíveis com badge
      //    "N conciliado(s)" no cabeçalho do painel, permitindo desfazer.
      try {
        await Promise.all([
          loadLancamentosFromPeriod(dataInicio, dataFim, selectedConta),
          hydrateExtratoPersistido({ contaId: selectedConta, from: dataInicio, to: dataFim }),
        ]);
      } catch (reloadErr) {
        logger.warn("[conciliacao] falha ao recarregar estado pós-confirmação:", reloadErr);
      }
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
      } else if (lancamentosConciliadosIds.has(l.id)) {
        statusConciliacao = "conciliado";
      }
      return { ...l, statusConciliacao, extratoId: match?.extratoId ?? null, divergencia };
    });
  }, [lancamentos, matches, extratoItems, lancamentosConciliadosIds]);

  const filteredData = useMemo(() => {
    return lancamentosComStatus.filter((l) => {
      if (showOnlyPendentes && l.statusConciliacao === "conciliado") return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const nome = l.tipo === "receber"
          ? l.clientes?.nome_razao_social
          : l.fornecedores?.nome_razao_social;
        if (
          !l.descricao?.toLowerCase().includes(term) &&
          !nome?.toLowerCase().includes(term) &&
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
  }, [lancamentosComStatus, searchTerm, statusConcFilters, tipoFilters, origemFilters, showOnlyPendentes]);

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
    usedLancamentoIds, getMatch, sugestoesPersistidas,
    conciliadosPersistidos,
    // handlers
    handleFileSelect, handleContaChange,
    handleAutoMatch, handleManualMatch,
    handleConciliacaoAutomatica, handleConfirmarConciliacao,
    handleAceitarSugestao, handleAceitarSugestoesPersistidas, handleRejeitarSugestao,
    handleDesfazerConciliacaoPersistida,
    handleCriarLancamentoInline,
    handleConfirmarSelecao, handleDesvincularExtrato,
    handleExcluirExtratosSelecionados,
    setMatches,
    // Sprint 1
    showOnlyPendentes, setShowOnlyPendentes,
    lancamentosConciliadosIds,
  };
}