import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Receipt,
  FileWarning,
  Inbox,
  Calculator,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  History,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SummaryCard } from "@/components/SummaryCard";
import { PeriodFilter } from "@/components/filters/PeriodFilter";
import { CertificadoValidadeAlert } from "@/components/fiscal/CertificadoValidadeAlert";
import {
  fetchDashboardFiscal,
  type DashboardFiscalKpis,
} from "@/services/fiscal/dashboardFiscal.service";
import { periodToDateFrom } from "@/lib/periodFilter";
import type { Period } from "@/components/filters/periodTypes";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
  CartesianGrid,
} from "recharts";

/**
 * Dashboard Fiscal (Onda 18) — visão consolidada de emissão (saída) e
 * recebimento (DistDF-e), apuração de tributos, eventos pendentes,
 * sincronização do cron e saúde do certificado A1.
 */

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export default function FiscalDashboard() {
  const [period, setPeriod] = useState<Period>("30d");

  const periodo = useMemo(
    () => ({ from: periodToDateFrom(period), to: todayIso() }),
    [period],
  );

  const { data, isLoading, refetch, isFetching } = useQuery<DashboardFiscalKpis>({
    queryKey: ["fiscal-dashboard", periodo.from, periodo.to],
    queryFn: () => fetchDashboardFiscal(periodo),
    staleTime: 60 * 1000,
  });

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard Fiscal</h1>
          <p className="text-sm text-muted-foreground">
            Visão consolidada de emissão, recebimento, tributos e saúde do certificado.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PeriodFilter value={period} onChange={(p) => setPeriod(p as Period)} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      <CertificadoValidadeAlert />

      {isLoading || !data ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" aria-busy="true" />
          ))}
        </div>
      ) : (
        <>
          {/* Linha 1 — Emissão (saída) */}
          <section aria-labelledby="kpi-saida">
            <h2 id="kpi-saida" className="text-sm font-medium text-muted-foreground mb-2">
              NF-e Emitidas (saída)
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard
                title="Autorizadas"
                value={data.saida.autorizadas}
                subtitle={fmtBRL(data.saida.valorAutorizado)}
                variant="success"
                icon={Receipt}
                density="compact"
              />
              <SummaryCard
                title="Rejeitadas"
                value={data.saida.rejeitadas}
                variant={data.saida.rejeitadas > 0 ? "danger" : "default"}
                icon={FileWarning}
                density="compact"
              />
              <SummaryCard
                title="Canceladas"
                value={data.saida.canceladas}
                variant="warning"
                icon={AlertTriangle}
                density="compact"
              />
              <SummaryCard
                title="Pendentes / rascunho"
                value={data.saida.pendentes}
                variant="info"
                icon={TrendingUp}
                density="compact"
              />
            </div>
          </section>

          {/* Linha 2 — Entrada (DistDF-e) */}
          <section aria-labelledby="kpi-entrada">
            <h2 id="kpi-entrada" className="text-sm font-medium text-muted-foreground mb-2">
              NF-e Recebidas (entrada — DistDF-e)
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard
                title="Total recebidas"
                value={data.entrada.total}
                subtitle={fmtBRL(data.entrada.valorTotal)}
                variant="info"
                icon={Inbox}
                density="compact"
              />
              <SummaryCard
                title="Sem manifestação"
                value={data.entrada.semManifestacao}
                variant={data.entrada.semManifestacao > 0 ? "warning" : "default"}
                icon={AlertTriangle}
                density="compact"
              />
              <SummaryCard
                title="Ciência / Confirmadas"
                value={data.entrada.cienciaConfirmada}
                variant="success"
                icon={ShieldCheck}
                density="compact"
              />
              <SummaryCard
                title="Desconhecidas / Não realizadas"
                value={data.entrada.desconhecidaNaoRealizada}
                variant="default"
                icon={FileWarning}
                density="compact"
              />
            </div>
          </section>

          {/* Linha 3 — Tributos */}
          <section aria-labelledby="kpi-tributos">
            <h2 id="kpi-tributos" className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <Calculator className="h-4 w-4" /> Apuração no período (NF-e autorizadas)
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <SummaryCard title="ICMS" value={fmtBRL(data.tributos.icms)} density="compact" />
              <SummaryCard title="ICMS-ST" value={fmtBRL(data.tributos.icmsSt)} density="compact" />
              <SummaryCard title="IPI" value={fmtBRL(data.tributos.ipi)} density="compact" />
              <SummaryCard title="PIS" value={fmtBRL(data.tributos.pis)} density="compact" />
              <SummaryCard title="COFINS" value={fmtBRL(data.tributos.cofins)} density="compact" />
            </div>
          </section>

          {/* Linha 4 — Gráfico série diária + Estado da empresa/sync */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Movimento diário no período</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {data.serieDiaria.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    Sem movimento no período selecionado.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data.serieDiaria}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 6, fontSize: 12 }}
                        labelFormatter={(l) => `Dia ${l}`}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="emitidas" name="Emitidas (saída)" fill="hsl(var(--primary))" />
                      <Bar dataKey="recebidas" name="Recebidas (entrada)" fill="hsl(var(--warning))" />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-4 w-4" /> Sincronização DistDF-e
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Última execução</span>
                    <strong>
                      {data.sincronizacao.ultimaSyncAt
                        ? format(new Date(data.sincronizacao.ultimaSyncAt), "dd/MM HH:mm", { locale: ptBR })
                        : "—"}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">cStat</span>
                    <Badge variant={data.sincronizacao.ultimoCStat === "138" ? "secondary" : "outline"}>
                      {data.sincronizacao.ultimoCStat ?? "—"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CNPJs monitorados</span>
                    <strong>{data.sincronizacao.qtdCnpjs}</strong>
                  </div>
                  <Button variant="outline" size="sm" className="w-full mt-2" asChild>
                    <Link to="/fiscal/distdfe-historico">
                      Ver histórico <ArrowRight className="h-3.5 w-3.5 ml-2" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" /> Configuração de emissão
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ambiente</span>
                    <Badge variant={data.empresa.ambiente === "1" ? "default" : "secondary"}>
                      {data.empresa.ambiente === "1" ? "Produção" : "Homologação"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Próximo nº · série</span>
                    <strong>
                      {data.empresa.proximoNumero ?? "—"} · {data.empresa.serie ?? "—"}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Modo emissão</span>
                    <strong>{data.empresa.modoEmissao ?? "normal"}</strong>
                  </div>
                  {data.empresa.contingenciaAtiva && (
                    <Badge variant="destructive" className="w-full justify-center mt-2">
                      Contingência ATIVA
                    </Badge>
                  )}
                  <Button variant="outline" size="sm" className="w-full mt-2" asChild>
                    <Link to="/administracao?tab=fiscal">
                      Configurar <ArrowRight className="h-3.5 w-3.5 ml-2" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}