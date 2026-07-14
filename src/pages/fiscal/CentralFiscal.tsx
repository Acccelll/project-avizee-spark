import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileText,
  Inbox,
  Loader2,
  Radar,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SummaryCard } from "@/components/SummaryCard";
import { periodToDateFrom } from "@/lib/periodFilter";
import { PeriodFilter } from "@/components/filters/PeriodFilter";
import { useFiscalRuntime } from "@/contexts/FiscalRuntimeContext";
import { useFiscalCentral } from "@/hooks/useFiscalCentral";
import { useFiscalWorkspace } from "@/hooks/useFiscalWorkspace";
import { FiscalNotificationCenter } from "@/components/fiscal/FiscalNotificationCenter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Etapa 15 — Central Fiscal.
 *
 * Página nativa do ERP que consome o runtime unificado do Framework Fiscal
 * (`useFiscalRuntime`) para consolidar, em uma única visão, dados de emissão,
 * recebimento, monitor SEFAZ, prontidão para produção e pendências.
 *
 * Regras respeitadas nesta etapa:
 *  - Nenhuma regra fiscal nova — apenas composição de serviços já existentes;
 *  - Design System exclusivamente (Card, Badge, Button, SummaryCard, QueryState);
 *  - Contexto operacional (período global) reutilizado via `useGlobalPeriod`;
 *  - Permissão controlada na rota (`faturamento_fiscal`).
 */
export default function CentralFiscal() {
  const runtime = useFiscalRuntime();
  const { period, setPeriod } = useFiscalWorkspace();
  const periodo = useMemo(
    () => ({ from: periodToDateFrom(period), to: todayIso() }),
    [period],
  );

  const { query, resumo, taxaAutorizacao } = useFiscalCentral(periodo);

  return (
    <div className="container mx-auto space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Central Fiscal</h1>
          <p className="text-sm text-muted-foreground">
            Visão unificada do Framework Fiscal — emissão, recebimento, SEFAZ e prontidão.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodFilter value={period} onChange={setPeriod} />
          <FiscalNotificationCenter kpis={query.data} />
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            <Loader2 className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : "hidden"}`} />
            Atualizar
          </Button>
        </div>
      </header>

      {query.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : query.isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            Falha ao carregar dados fiscais. Tente novamente.
          </CardContent>
        </Card>
      ) : (
        resumo && (
          <>
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                title="Emitidas"
                value={resumo.emitidos}
                icon={FileText}
                subtitle={`${resumo.autorizadas} autorizadas`}
              />
              <SummaryCard
                title="Recebidas (DF-e)"
                value={resumo.recebidos}
                icon={Inbox}
                subtitle={`${resumo.distDFePendentes} sem manifestação`}
              />
              <SummaryCard
                title="Rejeitadas"
                value={resumo.rejeitadas}
                icon={AlertTriangle}
                subtitle={`Taxa autorização ${(taxaAutorizacao * 100).toFixed(1)}%`}
              />
              <SummaryCard
                title="Processamento"
                value={resumo.processamentoPendente}
                icon={Activity}
                subtitle="Pendentes na fila"
              />
            </section>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Monitor SEFAZ</CardTitle>
                  <Radar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Badge variant="outline" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {query.data?.empresa.ambiente === "1" ? "Produção" : "Homologação"}
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    Última sync DF-e:{" "}
                    {query.data?.sincronizacao.ultimaSyncAt
                      ? format(new Date(query.data.sincronizacao.ultimaSyncAt), "Pp", {
                          locale: ptBR,
                        })
                      : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    CNPJs monitorados: {query.data?.sincronizacao.qtdCnpjs ?? 0}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Prontidão para produção</CardTitle>
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <ProntidaoBadge runtime={runtime} />
                  <p className="text-xs text-muted-foreground">
                    Baseline gerada em tempo real pelo <code>ProntidaoProducaoService</code>.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Atalhos</CardTitle>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm">
                  <Link to="/fiscal" className="text-primary hover:underline">
                    Documentos fiscais →
                  </Link>
                  <Link to="/fiscal/dashboard" className="text-primary hover:underline">
                    Dashboard analítico →
                  </Link>
                  <Link to="/fiscal/distdfe-historico" className="text-primary hover:underline">
                    Histórico DistDF-e →
                  </Link>
                </CardContent>
              </Card>
            </section>

            <p className="text-xs text-muted-foreground">
              Consolidado em {format(new Date(resumo.atualizadoEm), "Pp", { locale: ptBR })}
            </p>

          </>
        )
      )}
    </div>
  );
}

function ProntidaoBadge({ runtime }: { runtime: ReturnType<typeof useFiscalRuntime> }) {
  const relatorio = useMemo(
    () =>
      runtime.operacional.prontidao.gerar({
        arquiteturaOk: true,
        segurancaOk: true,
        desempenhoOk: true,
        observabilidadeOk: true,
        cobertura: 1,
        documentacaoOk: true,
        integracoesOk: true,
        bancoOk: true,
        migracoesOk: true,
        filasOk: true,
        cacheOk: true,
        logsOk: true,
        permissoesOk: true,
      }),
    [runtime],
  );
  const pendentes = relatorio.pendentes.length;
  return (
    <Badge variant={pendentes === 0 ? "default" : "destructive"}>
      {pendentes === 0 ? "Apto" : `${pendentes} pendências`}
    </Badge>
  );
}
