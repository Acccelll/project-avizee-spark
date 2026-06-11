import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  sincronizarDistDFe,
  obterStatusDistDFe,
  testarWorkerDistDFe,
  verificarCircuitBreaker,
  buscarNFeDestinatario,
  type DistDFeStatus,
  type WorkerPingResult,
  type CircuitBreakerInfo,
  type BuscaDestinatarioResult,
} from "@/services/fiscal/sefaz";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, PlayCircle, Zap, Loader2, ShieldCheck, ShieldAlert, ShieldQuestion, Activity, History } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAppConfig } from "@/hooks/useAppConfig";
import {
  aplicarCienciaEmLote,
  buscarNfeSemManifestacao,
} from "@/services/fiscal/autoCiencia.service";

/**
 * Histórico de execuções do cron `process-distdfe-cron`.
 *
 * Lê `auditoria_logs` filtrado por `acao='distdfe_cron_run'` (gravado pela
 * edge function ao final de cada execução), exibindo KPIs por execução e
 * detalhes por CNPJ, com botão de re-execução manual.
 */

interface ExecucaoDetalhe {
  cnpj: string;
  sucesso: boolean;
  novos: number;
  duplicados: number;
  cStat?: string;
  xMotivo?: string;
  erro?: string;
}

interface ExecucaoLog {
  id: string;
  created_at: string;
  dados_novos: {
    ambiente?: "1" | "2";
    inicio?: string;
    fim?: string;
    total_cnpjs?: number;
    total_novos?: number;
    total_duplicados?: number;
    total_erros?: number;
    detalhes?: ExecucaoDetalhe[];
  } | null;
}

export default function DistDFeHistorico() {
  const [rows, setRows] = useState<ExecucaoLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const {
    value: autoCiencia,
    save: saveAutoCiencia,
    loading: loadingFlag,
  } = useAppConfig<boolean>("distdfe_auto_ciencia", false);
  const [aplicandoLote, setAplicandoLote] = useState(false);
  const [status, setStatus] = useState<DistDFeStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [pinging, setPinging] = useState<"1" | "2" | null>(null);
  const [pingResult, setPingResult] = useState<(WorkerPingResult & { ranAt: string }) | null>(null);
  const [lastResult, setLastResult] = useState<
    | {
        ambiente: "1" | "2";
        ranAt: string;
        sucesso: boolean;
        novos: number;
        duplicados: number;
        cStat?: string;
        xMotivo?: string;
        erro?: string;
      }
    | null
  >(null);
  const [circuitBreakerInfo, setCircuitBreakerInfo] = useState<CircuitBreakerInfo | null>(null);
  const [buscandoRetro, setBuscandoRetro] = useState(false);
  const [retroResult, setRetroResult] = useState<{
    totalNovas: number;
    totalDuplicadas: number;
    paginas: number;
    erro?: string;
  } | null>(null);

  const carregarStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const s = await obterStatusDistDFe();
      setStatus(s);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => { void carregarStatus(); }, [carregarStatus]);

  const testarWorker = async (ambiente: "1" | "2") => {
    setPinging(ambiente);
    try {
      const r = await testarWorkerDistDFe(ambiente);
      setPingResult({ ...r, ranAt: new Date().toISOString() });
      const desc = r.diagnostico ?? r.erro ?? "Sem detalhes";
      if (r.sucesso) toast.success("Worker OK", { description: desc });
      else toast.error("Worker com problema", { description: desc });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Erro ao testar Worker", { description: msg });
    } finally {
      setPinging(null);
    }
  };

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("auditoria_logs")
      .select("id, created_at, dados_novos")
      .eq("acao", "distdfe_cron_run")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      toast.error("Erro ao carregar histórico", { description: error.message });
    } else {
      setRows((data ?? []) as unknown as ExecucaoLog[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const executarAgora = async (ambiente: "1" | "2") => {
    setRunning(true);
    const startedAt = new Date().toISOString();
    try {
      // Verifica circuit breaker ANTES de chamar a SEFAZ para evitar nova rejeição 656.
      const cb = await verificarCircuitBreaker(ambiente);
      if (cb.ativo) {
        setCircuitBreakerInfo(cb);
        setLastResult({
          ambiente,
          ranAt: startedAt,
          sucesso: false,
          novos: 0,
          duplicados: 0,
          cStat: "656",
          xMotivo: `Circuit breaker ativo — aguarde ${cb.minutosRestantes} min`,
        });
        toast.error("Sincronização bloqueada — Consumo Indevido anterior", {
          description: `O Ambiente Nacional bloqueou consultas para este CNPJ. Tente novamente em ~${cb.minutosRestantes} minuto(s) (até ${cb.ate ? new Date(cb.ate).toLocaleTimeString("pt-BR") : "?"}).`,
        });
        return;
      }
      setCircuitBreakerInfo(null);

      const r = await sincronizarDistDFe(ambiente);
      const nada = (r.novos ?? 0) === 0 && (r.duplicados ?? 0) === 0;
      const cStat656 = r.cStat === "656";
      setLastResult({
        ambiente,
        ranAt: startedAt,
        sucesso: r.sucesso,
        novos: r.novos,
        duplicados: r.duplicados,
        cStat: r.cStat,
        xMotivo: r.xMotivo,
        erro: r.erro,
      });
      if (r.sucesso && !cStat656) {
        toast.success("Sincronização concluída", {
          description: nada
            ? `Nenhum documento novo no Ambiente Nacional (cStat ${r.cStat ?? "—"} ${r.xMotivo ?? ""}).`
            : `${r.novos} nova(s), ${r.duplicados} existente(s).`,
        });
      } else if (cStat656) {
        const cb656: CircuitBreakerInfo = { ativo: true, minutosRestantes: 60 };
        setCircuitBreakerInfo(cb656);
        toast.error("SEFAZ — Consumo Indevido (cStat 656)", {
          description:
            "O Ambiente Nacional bloqueou consultas para este CNPJ por ~1 hora. " +
            "Isso ocorre quando a mesma consulta é repetida sem usar o último NSU retornado. " +
            "O sistema aguardará automaticamente. Tente novamente em ~60 minutos.",
          duration: 10000,
        });
      } else {
        toast.error("Falha na sincronização", {
          description: r.erro ?? r.xMotivo ?? "Erro desconhecido",
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLastResult({ ambiente, ranAt: startedAt, sucesso: false, novos: 0, duplicados: 0, erro: msg });
      toast.error("Erro ao chamar edge function", { description: msg });
    } finally {
      setRunning(false);
      void carregar();
    }
  };

  /**
   * Busca retroativa via consNFeDest — não depende do NSU do DistDFe.
   * Pagina automaticamente enquanto houver mais documentos (temMais=true).
   * Limite de 20 páginas (~1000 NF-e) por execução para evitar timeout.
   */
  const buscarRetroativamente = async () => {
    setBuscandoRetro(true);
    setRetroResult(null);
    let totalNovas = 0;
    let totalDuplicadas = 0;
    let paginas = 0;
    let ultNSU: string | undefined = undefined;
    const MAX_PAGINAS = 20;

    try {
      while (paginas < MAX_PAGINAS) {
        const r: BuscaDestinatarioResult = await buscarNFeDestinatario(ultNSU);
        paginas++;

        if (!r.sucesso) {
          setRetroResult({ totalNovas, totalDuplicadas, paginas, erro: r.erro ?? r.xMotivo });
          toast.error("Busca retroativa falhou", {
            description: r.erro ?? r.xMotivo ?? `cStat ${r.cStat ?? "?"}`,
          });
          return;
        }

        totalNovas += r.novas ?? 0;
        totalDuplicadas += r.duplicadas ?? 0;

        if (!r.temMais || !r.ultNSU) break;
        ultNSU = r.ultNSU;

        // Pausa de 500ms entre páginas para não pressionar o SEFAZ.
        await new Promise((res) => setTimeout(res, 500));
      }

      setRetroResult({ totalNovas, totalDuplicadas, paginas });
      toast.success("Busca retroativa concluída", {
        description: `${totalNovas} NF-e nova(s) registrada(s), ${totalDuplicadas} já existente(s). (${paginas} página(s) consultada(s))`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setRetroResult({ totalNovas, totalDuplicadas, paginas, erro: msg });
      toast.error("Erro na busca retroativa", { description: msg });
    } finally {
      setBuscandoRetro(false);
    }
  };

  const ultima = rows[0];
  const kpis = useMemo(() => {
    const ultimas10 = rows.slice(0, 10);
    return {
      execucoes: rows.length,
      novos10: ultimas10.reduce((s, r) => s + (r.dados_novos?.total_novos ?? 0), 0),
      erros10: ultimas10.reduce((s, r) => s + (r.dados_novos?.total_erros ?? 0), 0),
    };
  }, [rows]);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/faturamento" aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Histórico DistDF-e</h1>
            <p className="text-sm text-muted-foreground">
              Execuções do cron diário de sincronização de NF-e de entrada (SEFAZ Ambiente Nacional)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void carregar()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button onClick={() => void executarAgora("2")} disabled={running}>
            {running ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4 mr-2" />
            )}
            {running ? "Sincronizando..." : "Sincronizar (Hom.)"}
          </Button>
          <Button variant="secondary" onClick={() => void executarAgora("1")} disabled={running}>
            {running ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4 mr-2" />
            )}
            Sincronizar (Prod.)
          </Button>
          <Button variant="outline" onClick={() => void testarWorker("2")} disabled={pinging !== null}>
            {pinging === "2" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Activity className="h-4 w-4 mr-2" />}
            Testar Worker (Hom.)
          </Button>
          <Button variant="outline" onClick={() => void testarWorker("1")} disabled={pinging !== null}>
            {pinging === "1" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Activity className="h-4 w-4 mr-2" />}
            Testar Worker (Prod.)
          </Button>
        </div>
      </div>

      {/* Indicador de transporte / Worker mTLS */}
      {loadingStatus ? (
        <Skeleton className="h-14 w-full" />
      ) : status?.proxyEnabled ? (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 px-4 py-3 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div className="text-sm">
            <div className="font-medium text-emerald-700 dark:text-emerald-300">Proxy mTLS ativo</div>
            <div className="text-xs text-muted-foreground">
              Todas as chamadas SEFAZ saem por Cloudflare Worker com IP brasileiro. Transporte: <code className="font-mono">{status.transporte}</code>.
            </div>
          </div>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => void carregarStatus()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : status ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm flex-1">
            <div className="font-medium text-destructive">Proxy mTLS inativo — sincronização vai falhar com CONNECTION_RESET</div>
            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
              <div>
                <strong>Flag SEFAZ_USE_MTLS_PROXY:</strong>{" "}
                {status.flagAtiva ? "ativa ✓" : `inativa (valor com ${status.flagLen} caractere(s); deve ser exatamente "true")`}
              </div>
              <div>
                <strong>URL do Worker:</strong> {status.hasProxyUrl ? "configurada ✓" : "ausente ✗"}
              </div>
              <div>
                <strong>Secret do Worker:</strong> {status.hasProxySecret ? "configurado ✓" : "ausente ✗"}
              </div>
              <div className="pt-1">Corrija os secrets em Cloud → Secrets para que o transporte resolva como <code className="font-mono">cf-worker-mtls</code>.</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void carregarStatus()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="rounded-md border border-muted px-4 py-3 flex items-center gap-3">
          <ShieldQuestion className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="text-sm text-muted-foreground">Status de transporte SEFAZ indisponível.</div>
        </div>
      )}

      {circuitBreakerInfo?.ativo && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-4 py-3 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium text-amber-700 dark:text-amber-300">
              Circuit breaker ativo — sincronização bloqueada por cStat 656
            </div>
            {circuitBreakerInfo.minutosRestantes != null && (
              <div className="text-xs text-muted-foreground mt-0.5">
                Aguarde ~{circuitBreakerInfo.minutosRestantes} minuto(s) antes de tentar novamente.
                {circuitBreakerInfo.ate && (
                  <> Liberação prevista às {new Date(circuitBreakerInfo.ate).toLocaleTimeString("pt-BR")}.</>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {lastResult && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            lastResult.sucesso && lastResult.cStat !== "656"
              ? "border-emerald-500/40 bg-emerald-500/5"
              : "border-destructive/40 bg-destructive/5"
          }`}
        >
          <div className="font-medium">
            Última execução manual — Ambiente {lastResult.ambiente === "1" ? "Produção" : "Homologação"} (
            {format(new Date(lastResult.ranAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })})
          </div>
          <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
            <div>
              <strong>Resultado:</strong>{" "}
              {lastResult.sucesso
                ? lastResult.cStat === "656"
                  ? "Recusado — Consumo Indevido (cStat 656)"
                  : "Concluído"
                : "Falha"}
            </div>
            {lastResult.cStat && (
              <div>
                <strong>cStat:</strong> {lastResult.cStat} {lastResult.xMotivo ? `— ${lastResult.xMotivo}` : ""}
              </div>
            )}
            <div>
              <strong>Documentos:</strong> {lastResult.novos} nova(s), {lastResult.duplicados} existente(s)
            </div>
            {lastResult.erro && (
              <div className="break-words">
                <strong>Erro:</strong> {lastResult.erro}
              </div>
            )}
          </div>
        </div>
      )}

      {pingResult && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            pingResult.sucesso ? "border-emerald-500/40 bg-emerald-500/5" : "border-destructive/40 bg-destructive/5"
          }`}
        >
          <div className="font-medium">
            Teste do Worker — Ambiente {pingResult.ambiente === "1" ? "Produção" : "Homologação"} (
            {format(new Date(pingResult.ranAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })})
          </div>
          <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
            {pingResult.targetUrl && (
              <div className="break-all"><strong>URL alvo:</strong> <code className="font-mono">{pingResult.targetUrl}</code></div>
            )}
            {typeof pingResult.statusHttp === "number" && (
              <div><strong>HTTP:</strong> {pingResult.statusHttp} {pingResult.statusText ?? ""}</div>
            )}
            {typeof pingResult.bytes === "number" && (
              <div><strong>Bytes:</strong> {pingResult.bytes}</div>
            )}
            {pingResult.diagnostico && (
              <div className="break-words"><strong>Diagnóstico:</strong> {pingResult.diagnostico}</div>
            )}
            {pingResult.preview && (
              <pre className="mt-2 text-[11px] bg-muted/40 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">{pingResult.preview}</pre>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Execuções (últimas 50)</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{kpis.execucoes}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">NF-e novas (últimas 10)</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{kpis.novos10}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Erros (últimas 10)</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-2xl font-semibold ${kpis.erros10 > 0 ? "text-destructive" : ""}`}>{kpis.erros10}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-amber-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Auto-Ciência da Operação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Quando ativada, toda NF-e nova baixada pelo cron recebe automaticamente o evento{" "}
            <strong>NT 2012/002 — 210210 (Ciência da Operação)</strong> junto à SEFAZ, eliminando
            o passo manual. A confirmação efetiva (210200) ou desconhecimento (210220) continua
            sendo uma decisão do usuário fiscal.
          </p>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="auto-ciencia" className="cursor-pointer">
              <div className="font-medium">Aplicar ciência automaticamente</div>
              <div className="text-xs text-muted-foreground">
                Vale para novas NF-e detectadas após esta opção ser ligada.
              </div>
            </Label>
            <Switch
              id="auto-ciencia"
              checked={!!autoCiencia}
              disabled={loadingFlag}
              onCheckedChange={(v) => void saveAutoCiencia(v)}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={aplicandoLote}
            onClick={async () => {
              setAplicandoLote(true);
              try {
                const notas = await buscarNfeSemManifestacao(100);
                if (notas.length === 0) {
                  toast.info("Nada a fazer", { description: "Não há NF-e sem manifestação." });
                  return;
                }
                const r = await aplicarCienciaEmLote(notas);
                const msg = `${r.sucesso} ciência(s) aplicada(s) · ${r.falhas} falha(s).`;
                if (r.falhas > 0) toast.error("Lote concluído com falhas", { description: msg });
                else toast.success("Lote concluído", { description: msg });
              } catch (e) {
                toast.error("Falha no lote", { description: (e as Error).message });
              } finally {
                setAplicandoLote(false);
              }
            }}
          >
            {aplicandoLote ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            {aplicandoLote ? "Aplicando..." : "Aplicar ciência em lote agora"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Busca Retroativa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Consulta todas as NF-e emitidas para o CNPJ da empresa diretamente na
            SEFAZ (serviço <code className="font-mono">consNFeDest</code>), sem
            depender do cursor NSU do DistDFe. Use quando documentos anteriores
            não aparecem na lista (por exemplo, após reset do worker ou perda
            de NSU). Persiste as chaves em <code className="font-mono">nfe_distribuicao</code>;
            o XML completo é baixado depois pelo cron após a Ciência.
          </p>
          <Button
            variant="default"
            onClick={() => void buscarRetroativamente()}
            disabled={buscandoRetro || running}
            className="w-full sm:w-auto"
          >
            {buscandoRetro ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Buscando…
              </>
            ) : (
              <>
                <History className="h-4 w-4 mr-2" />
                Buscar NF-e Retroativamente
              </>
            )}
          </Button>
          {retroResult && (
            <div
              className={`rounded-md border px-3 py-2 text-sm ${
                retroResult.erro
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-emerald-500/40 bg-emerald-500/5"
              }`}
            >
              {retroResult.erro ? (
                <span className="text-destructive">Erro: {retroResult.erro}</span>
              ) : (
                <span>
                  ✓ {retroResult.totalNovas} NF-e nova(s) registrada(s),{" "}
                  {retroResult.totalDuplicadas} já existia(m). (
                  {retroResult.paginas} consulta(s))
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {ultima && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">Última execução</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>Quando: <strong>{format(new Date(ultima.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</strong></div>
            <div>Ambiente: <Badge variant={ultima.dados_novos?.ambiente === "1" ? "default" : "secondary"}>{ultima.dados_novos?.ambiente === "1" ? "Produção" : "Homologação"}</Badge></div>
            <div>CNPJs processados: {ultima.dados_novos?.total_cnpjs ?? 0} · Novos: <strong>{ultima.dados_novos?.total_novos ?? 0}</strong> · Duplicados: {ultima.dados_novos?.total_duplicados ?? 0} · Erros: <span className={(ultima.dados_novos?.total_erros ?? 0) > 0 ? "text-destructive font-semibold" : ""}>{ultima.dados_novos?.total_erros ?? 0}</span></div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Execuções recentes</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2" aria-busy="true">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma execução registrada ainda. O cron roda diariamente às 06:00 UTC.
            </div>
          ) : (
            <div className="border rounded-md divide-y">
              {rows.map((r) => {
                const d = r.dados_novos ?? {};
                const isOpen = expanded === r.id;
                const erros = d.total_erros ?? 0;
                return (
                  <div key={r.id}>
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : r.id)}
                      className="w-full px-4 py-3 hover:bg-muted/50 text-left flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-medium">
                          {format(new Date(r.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                        </span>
                        <Badge variant={d.ambiente === "1" ? "default" : "secondary"}>{d.ambiente === "1" ? "Prod" : "Hom"}</Badge>
                        <span className="text-xs text-muted-foreground">{d.total_cnpjs ?? 0} CNPJ(s)</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span>Novos: <strong className="text-foreground">{d.total_novos ?? 0}</strong></span>
                        <span className="text-muted-foreground">Dup: {d.total_duplicados ?? 0}</span>
                        <span className={erros > 0 ? "text-destructive font-semibold" : "text-muted-foreground"}>Erros: {erros}</span>
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 bg-muted/30">
                        {(d.detalhes ?? []).length === 0 ? (
                          <div className="text-xs text-muted-foreground py-2">Sem detalhes por CNPJ.</div>
                        ) : (
                          <div className="overflow-x-auto -mx-4 px-4">
                          <table className="w-full text-xs mt-2 min-w-[600px]">
                            <thead className="text-muted-foreground">
                              <tr className="text-left">
                                <th className="py-1">CNPJ</th>
                                <th className="py-1">Status</th>
                                <th className="py-1 text-right">Novos</th>
                                <th className="py-1 text-right">Dup.</th>
                                <th className="py-1">cStat</th>
                                <th className="py-1">Mensagem</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {(d.detalhes ?? []).map((det, idx) => (
                                <tr key={`${r.id}-${idx}`}>
                                  <td className="py-1 font-mono">{det.cnpj}</td>
                                  <td className="py-1">
                                    <Badge variant={det.sucesso ? "outline" : "destructive"}>
                                      {det.sucesso ? "OK" : "Falha"}
                                    </Badge>
                                  </td>
                                  <td className="py-1 text-right">{det.novos}</td>
                                  <td className="py-1 text-right">{det.duplicados}</td>
                                  <td className="py-1">{det.cStat ?? "—"}</td>
                                  <td className="py-1 text-muted-foreground">{det.xMotivo ?? det.erro ?? "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
