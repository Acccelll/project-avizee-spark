import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseOFXFile, type OFXTransaction } from "@/lib/parseOFX";
import {
  conciliarTransacao,
  confirmarConciliacao,
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
import { supabase } from "@/integrations/supabase/client";
import { importarDocumentoUniversal } from "@/services/financeiro/importacao/importarDocumento.service";
import {
  desfazerConciliacaoExtrato,
  excluirExtratosPorFitids,
  limparSugestaoExtrato,
  listarBaixasConciliadasPorFitids,
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
import { confirmAsync } from "@/lib/globalConfirm";
import { autoMatchBanco } from "@/services/financeiro/matching/autoMatchBanco";

const SUGESTAO_SCORE_THRESHOLD = 0.7;
const CONCILIACAO_LAST_CONTA_KEY = "conciliacao:bancaria:lastConta";
const CONCILIACAO_LAST_DATA_INICIO_KEY = "conciliacao:bancaria:lastDataInicio";
const CONCILIACAO_LAST_DATA_FIM_KEY = "conciliacao:bancaria:lastDataFim";

function getLancamentoSaldoParaConciliar(lancamento: Lancamento): number {
  const row = lancamento as Lancamento & { saldo_restante?: number | string | null };
  const saldo = row.saldo_restante == null ? null : Math.abs(Number(row.saldo_restante));
  if (saldo != null && Number.isFinite(saldo) && saldo > 0.009) return saldo;
  return Math.abs(Number(lancamento.valor));
}

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

  // Modal inline "Novo Lançamento" (evita navegação para /financeiro)
  const [novoLancOpen, setNovoLancOpen] = useState(false);
  const [novoLancPrefill, setNovoLancPrefill] = useState<Record<string, unknown> | null>(null);

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
      // Cruza fitid → baixas para marcar TODOS os lançamentos conciliados.
      // Em 1↔N, `financeiro_extrato_importacoes.baixa_id` guarda só uma baixa
      // representativa; as demais ficam em `financeiro_baixas.conciliacao_extrato_referencia`.
      const fitidsConciliados = Array.from(conciliados.keys());
      let baixaIds = Array.from(conciliados.values())
        .map((c) => c.baixaId)
        .filter((v): v is string => !!v);
      const lancamentosIds = new Set<string>();
      const conciliadosHidratados = new Map(conciliados);
      if (fitidsConciliados.length > 0) {
        try {
          const baixasPorFitid = await listarBaixasConciliadasPorFitids({
            contaBancariaId: contaId,
            fitids: fitidsConciliados,
          });
          baixaIds = Array.from(new Set([
            ...baixaIds,
            ...Array.from(baixasPorFitid.values()).flat().map((b) => b.baixaId),
          ]));
          baixasPorFitid.forEach((baixas, fitid) => {
            const atual = conciliadosHidratados.get(fitid);
            if (!atual) return;
            conciliadosHidratados.set(fitid, {
              ...atual,
              baixaId: atual.baixaId ?? baixas[0]?.baixaId ?? null,
              baixaIds: baixas.map((b) => b.baixaId),
            });
            baixas.forEach((b) => lancamentosIds.add(b.lancamentoId));
          });
        } catch (err) {
          logger.warn("[conciliacao] falha ao carregar baixas por fitid:", err);
        }
      }
      setConciliadosPersistidos(conciliadosHidratados);
      if (baixaIds.length > 0) {
        try {
          const mapa = await mapBaixasParaLancamentos(baixaIds);
          mapa.forEach((lancamentoId) => lancamentosIds.add(lancamentoId));
          setLancamentosConciliadosIds(lancamentosIds);
        } catch (err) {
          logger.warn("[conciliacao] falha ao mapear baixas→lançamentos:", err);
          setLancamentosConciliadosIds(lancamentosIds);
        }
      } else {
        setLancamentosConciliadosIds(lancamentosIds);
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
    const confirmar = await confirmAsync({
      title: "Excluir linhas do extrato",
      description: conciliadosNoLote > 0
        ? `${conciliadosNoLote} das ${fitids.length} linhas selecionadas já estão conciliadas e serão preservadas. Excluir as demais?`
        : `Excluir ${fitids.length} linha(s) do extrato importado? Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      confirmVariant: "destructive",
    });
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
      const preservadas = fitids.length - res.excluidas;
      toast.success(
        preservadas > 0
          ? `${res.excluidas} linha(s) excluída(s). ${preservadas} preservada(s) por já estarem conciliadas.`
          : `${res.excluidas} linha(s) excluída(s) do extrato.`,
      );
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
        // Sanity-check: se o BANKID/ORG do OFX não bater com o banco da conta
        // selecionada, os FITIDs colidem (bancos que numeram por data + seq)
        // e o upsert idempotente descarta as linhas silenciosamente. Bloquear
        // aqui evita perda de dados invisível ao usuário.
        if (selectedConta) {
          try {
            const rawText = await file.text();
            const org = rawText.match(/<ORG>\s*([^<\r\n]+)/i)?.[1]?.trim() ?? "";
            const contaSel = contasBancarias.find((c) => c.id === selectedConta);
            const bancoConta = (contaSel?.banco ?? "").trim();
            const norm = (s: string) =>
              s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
            if (org && bancoConta && !norm(org).includes(norm(bancoConta)) && !norm(bancoConta).includes(norm(org))) {
              const ok = await confirmAsync({
                title: "Banco do arquivo diferente da conta",
                description: `O arquivo é do banco "${org}", mas a conta selecionada é "${contaSel?.nome}" (${bancoConta}). Importar assim pode fazer com que várias linhas sejam ignoradas por colisão de FITID. Continuar mesmo assim?`,
                confirmLabel: "Importar mesmo assim",
                confirmVariant: "destructive",
              });
              if (!ok) return;
            }
          } catch {
            /* leitura best-effort */
          }
        }
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
    const confirmar = await confirmAsync({
      title: "Desfazer conciliação",
      description: "Desfazer a conciliação irá estornar a baixa financeira vinculada. Continuar?",
      confirmLabel: "Desfazer",
      confirmVariant: "destructive",
    });
    if (!confirmar) return false;
    try {
      await desfazerConciliacaoExtrato({
        extratoPersistidoId: conc.extratoPersistidoId,
        baixaId: conc.baixaId,
        baixaIds: conc.baixaIds,
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
      // Reidrata em paralelo o eixo lançamentos + eixo extrato para que a UI
      // reflita imediatamente o novo saldo/status sem exigir refresh manual.
      try {
        await Promise.all([
          loadLancamentosFromPeriod(dataInicio, dataFim, selectedConta),
          hydrateExtratoPersistido({ contaId: selectedConta, from: dataInicio, to: dataFim }),
        ]);
      } catch (reloadErr) {
        logger.warn("[conciliacao] falha ao recarregar estado pós-desfazer:", reloadErr);
      }
      toast.success("Conciliação desfeita. A baixa foi estornada.");
      return true;
    } catch (err) {
      notifyError(err);
      return false;
    }
  }, [conciliadosPersistidos, dataFim, dataInicio, hydrateExtratoPersistido, loadLancamentosFromPeriod, selectedConta]);

  const handleContaChange = async (contaId: string) => {
    setSelectedConta(contaId);
    setMatches([]);
  };

  /**
   * Match por valor — pareia pelo mesmo valor absoluto, IGNORANDO a data.
   * Complementa "Conciliar automaticamente" (que exige data + valor).
   */
  const handleAutoMatch = async () => {
    if (!selectedConta) {
      toast.error("Selecione uma conta bancária antes de conciliar.");
      return;
    }
    const bloqueados = new Set<string>([
      ...lancamentosConciliadosIds,
      ...matches.map((m) => m.lancamentoId),
    ]);
    const newMatches: Match[] = autoMatchBanco(extratoItems, lancamentos, {
      soValor: true,
      lancamentosBloqueados: bloqueados,
    }).map((r) => ({ extratoId: r.extratoId, lancamentoId: r.lancamentoId, origem: "heuristica" }));
    setMatches((prev) => {
      const manual = prev.filter((m) => !newMatches.some((nm) => nm.extratoId === m.extratoId));
      return [...manual, ...newMatches];
    });
    toast.success(
      `${newMatches.length} par(es) encontrado(s) por valor. Revise e clique em "Confirmar Conciliação".`,
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
      const novos: Match[] = [];
      if (extratoIds.length > 1 && lancamentoIds.length > 1) {
        // N↔N: só é aceito quando os dois lados têm a MESMA quantidade —
        // fazemos pareamento posicional (linha a linha). Qualquer outro caso
        // é ambíguo e o usuário deve conciliar em passos.
        if (extratoIds.length !== lancamentoIds.length) {
          toast.error(
            "Seleção N↔N só é aceita quando os dois lados têm o mesmo número de linhas.",
          );
          return false;
        }
        for (let i = 0; i < extratoIds.length; i += 1) {
          novos.push({ extratoId: extratoIds[i], lancamentoId: lancamentoIds[i], origem: "manual" });
        }
      } else if (extratoIds.length === 1) {
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
   * Sprint 3 — Gera um lançamento de ajuste bancário para uma pequena
   * divergência (dentro da tolerância) e reidrata o estado da tela.
   */
  const handleGerarAjusteBancario = useCallback(async (input: {
    diferenca: number;
    data: string;
    descricao?: string;
  }): Promise<boolean> => {
    if (!selectedConta) {
      toast.error("Selecione uma conta bancária antes de gerar o ajuste.");
      return false;
    }
    if (Math.abs(input.diferenca) < 0.005) {
      toast.info("Sem divergência para ajustar.");
      return false;
    }
    try {
      const sessao = await obterSessaoEmpresa();
      if (!sessao) throw new Error("Sessão expirada.");
      const res = await gerarLancamentoAjusteBancario({
        empresa_id: sessao.empresaId,
        conta_bancaria_id: selectedConta,
        data: input.data,
        diferenca: input.diferenca,
        descricao: input.descricao,
      });
      void registrarAuditoriaConciliacao({
        empresaId: sessao.empresaId,
        usuarioId: sessao.userId,
        acao: "ajuste",
        entidade: "financeiro_lancamentos",
        entidadeId: res.lancamento_id,
        payload: { diferenca: input.diferenca, baixa_id: res.baixa_id },
      });
      toast.success("Ajuste bancário gerado e baixado.");
      await loadLancamentosFromPeriod(dataInicio, dataFim, selectedConta);
      return true;
    } catch (err) {
      notifyError(err);
      return false;
    }
  }, [dataFim, dataInicio, loadLancamentosFromPeriod, obterSessaoEmpresa, selectedConta]);

  /**
   * Atalho: abre a MESMA tela de "Novo Lançamento" do módulo Financeiro,
   * apenas pré-preenchida com os dados vindos do extrato OFX. Ao salvar,
   * gera um lançamento comum — a conciliação NÃO é automática.
   */
  const handleCriarLancamentoInline = useCallback((extratoId: string) => {
    const extrato = extratoItems.find((e) => e.id === extratoId);
    if (!extrato) return;
    setNovoLancPrefill({
      tipo: extrato.valor >= 0 ? "receber" : "pagar",
      descricao: extrato.descricao ?? "",
      valor: Math.abs(extrato.valor),
      data_vencimento: extrato.data,
      conta_bancaria_id: selectedConta || "",
    });
    setNovoLancOpen(true);
  }, [extratoItems, selectedConta]);

  const handleNovoLancamentoSaved = useCallback(async () => {
    await loadLancamentosFromPeriod(dataInicio, dataFim, selectedConta);
  }, [dataFim, dataInicio, loadLancamentosFromPeriod, selectedConta]);

  /**
   * Conciliar automaticamente — pareia pelos que batem em DATA + VALOR.
   * Não confirma sozinho: apenas monta os pares para o usuário revisar
   * e clicar em "Confirmar Conciliação".
   */
  const handleConciliacaoAutomatica = useCallback(() => {
    if (!selectedConta) {
      toast.error("Selecione uma conta bancária antes de conciliar.");
      return;
    }
    const bloqueados = new Set<string>([
      ...lancamentosConciliadosIds,
      ...matches.map((m) => m.lancamentoId),
    ]);
    const newMatches: Match[] = autoMatchBanco(extratoItems, lancamentos, {
      lancamentosBloqueados: bloqueados,
    }).map((r) => ({ extratoId: r.extratoId, lancamentoId: r.lancamentoId, origem: "heuristica" }));
    setMatches((prev) => {
      const manual = prev.filter((m) => !newMatches.some((nm) => nm.extratoId === m.extratoId));
      return [...manual, ...newMatches];
    });
    toast.success(
      `${newMatches.length} par(es) prontos para confirmar (data ±3d + valor).`,
    );
  }, [extratoItems, lancamentos, lancamentosConciliadosIds, matches, selectedConta]);

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
      // Conta ocorrências para detectar N↔1 (várias linhas de extrato para o
      // mesmo lançamento) e 1↔N (uma linha de extrato para vários lançamentos).
      // Em ambos casos gera baixas PARCIAIS proporcionais ao lado múltiplo,
      // preservando a integridade do saldo do título.
      const extratoCount = new Map<string, number>();
      const lancamentoCount = new Map<string, number>();
      payload.pares.forEach((p) => {
        extratoCount.set(p.extrato_id, (extratoCount.get(p.extrato_id) ?? 0) + 1);
        lancamentoCount.set(p.lancamento_id, (lancamentoCount.get(p.lancamento_id) ?? 0) + 1);
      });
      const baixasPorExtrato = new Map<string, string[]>();
      const paresComErro: Array<{ extratoId: string; lancamentoId: string; erro: string }> = [];
      // Executa em série para respeitar saldos parciais sequenciais.
      for (const par of payload.pares) {
        const extrato = extratoItems.find((e) => e.id === par.extrato_id);
        if (!extrato) continue;
        const transacao: TransacaoExtrato = {
          id: extrato.id,
          data: extrato.data,
          descricao: extrato.descricao,
          valor: extrato.valor,
          tipo: extrato.valor >= 0 ? "C" : "D",
        };
        const nExtratos = lancamentoCount.get(par.lancamento_id) ?? 1; // N extratos → 1 lanç
        const nLanc = extratoCount.get(par.extrato_id) ?? 1; // 1 extrato → N lanç
        let valorParcial: number | undefined;
        if (nExtratos > 1) {
          // Cada extrato baixa seu próprio valor no mesmo lançamento.
          valorParcial = Math.abs(extrato.valor);
        } else if (nLanc > 1) {
          // O extrato é dividido entre vários lançamentos: usa o saldo real do título.
          // Isso evita bloquear o segundo título quando há diferença de 1 centavo
          // por arredondamento entre valor original e saldo restante.
          const lanc = lancamentos.find((l) => l.id === par.lancamento_id);
          valorParcial = lanc ? getLancamentoSaldoParaConciliar(lanc) : undefined;
        }
        try {
          const baixaId = await conciliarTransacao(
            selectedConta,
            transacao,
            par.lancamento_id,
            valorParcial,
          );
          if (baixaId) {
            const ids = baixasPorExtrato.get(extrato.id) ?? [];
            ids.push(baixaId);
            baixasPorExtrato.set(extrato.id, ids);
          }
        } catch (err) {
          // Isola falhas por par: não aborta o lote — os demais pares
          // continuam sendo baixados/conciliados normalmente.
          const msg = err instanceof Error ? err.message : String(err);
          logger.warn(
            `[conciliacao] falha no par extrato=${par.extrato_id} lancamento=${par.lancamento_id}:`,
            err,
          );
          paresComErro.push({
            extratoId: par.extrato_id,
            lancamentoId: par.lancamento_id,
            erro: msg,
          });
        }
      }
      for (const [fitid, baixaIds] of baixasPorExtrato) {
        await marcarExtratoConciliadoPorFitid({
          contaBancariaId: selectedConta,
          fitid,
          baixaId: baixaIds[0] ?? null,
        });
      }
      try {
        await confirmarConciliacao({
          conta_bancaria_id: selectedConta,
          data_conciliacao: new Date().toISOString(),
          pares: payload.pares,
          usuario_id: undefined,
        });
      } catch (err) {
        // Não bloqueia o fluxo (baixas já foram efetivadas), mas registra
        // para auditoria — antes o erro era silenciosamente engolido.
        logger.warn("[conciliacao] confirmarConciliacao RPC falhou:", err);
      }
      const idsComErro = new Set(paresComErro.map((p) => p.extratoId));
      const paresOk = payload.pares.filter((p) => !idsComErro.has(p.extrato_id));
      const extratosPareados = new Set(paresOk.map((p) => p.extrato_id)).size;
      const semPar = Math.max(0, extratoItems.length - extratosPareados);
      if (paresComErro.length > 0) {
        toast.error(
          `${paresComErro.length} par(es) não conciliado(s). ${extratosPareados} baixa(s) efetivada(s).`,
        );
        paresComErro.slice(0, 3).forEach((e) => {
          logger.warn(`[conciliacao] erro por par: ${e.erro}`);
        });
      } else {
        toast.success(
          `${extratosPareados} transação(ões) conciliada(s) com sucesso! ${semPar} sem correspondência.`,
        );
      }
      setSugestoesPersistidas((prev) => {
        const next = new Map(prev);
        paresOk.forEach((par) => next.delete(par.extrato_id));
        return next;
      });
      // Mantém em `matches` apenas os pares que falharam, para revisão.
      setMatches((prev) => prev.filter((m) => idsComErro.has(m.extratoId)));
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
  // Bloqueia tanto lançamentos pareados na sessão quanto os já conciliados
  // (baixa persistida), evitando aceitar sugestão sobre lançamento indisponível.
  const usedLancamentoIds = new Set<string>([
    ...matches.map((m) => m.lancamentoId),
    ...Array.from(lancamentosConciliadosIds),
  ]);

  // KPI reflete tanto pares confirmados nesta sessão quanto conciliações já
  // persistidas (baixas), evitando o efeito "recarregou → contador zerou".
  const extratosPareadosSet = new Set<string>([
    ...matches.map((m) => m.extratoId),
    ...Array.from(conciliadosPersistidos.keys()),
  ]);
  const lancamentosPareadosSet = new Set<string>([
    ...matches.map((m) => m.lancamentoId),
    ...Array.from(lancamentosConciliadosIds),
  ]);
  const pareados = extratosPareadosSet.size;
  const semParOFX = Math.max(0, extratoItems.length - pareados);
  const pendentesERP = Math.max(0, lancamentos.length - lancamentosPareadosSet.size);

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
    if (key === "search") setSearchTerm("");
  };

  const handleClearAll = () => {
    setStatusConcFilters([]);
    setTipoFilters([]);
    setOrigemFilters([]);
    setSearchTerm("");
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
    // Modal inline "Novo Lançamento"
    novoLancOpen, setNovoLancOpen,
    novoLancPrefill,
    handleNovoLancamentoSaved,
    handleConfirmarSelecao, handleDesvincularExtrato,
    handleExcluirExtratosSelecionados,
    setMatches,
    // Sprint 1
    showOnlyPendentes, setShowOnlyPendentes,
    lancamentosConciliadosIds,
    // Sprint 3
    handleGerarAjusteBancario,
  };
}