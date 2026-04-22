import { lazy, Suspense, useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SummaryCard } from "@/components/SummaryCard";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { AlertStrip } from "@/components/dashboard/AlertStrip";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { FinanceiroBlock } from "@/components/dashboard/FinanceiroBlock";
import { ComercialBlock } from "@/components/dashboard/ComercialBlock";
import { EstoqueBlock } from "@/components/dashboard/EstoqueBlock";
import { LogisticaBlock } from "@/components/dashboard/LogisticaBlock";
import { FiscalBlock } from "@/components/dashboard/FiscalBlock";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { PendenciasList } from "@/components/dashboard/PendenciasList";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { BlockErrorBoundary } from "@/components/dashboard/BlockErrorBoundary";
import { ViewDrawerV2 } from "@/components/ViewDrawerV2";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardPeriodProvider } from "@/contexts/DashboardPeriodContext";
import { formatCurrency } from "@/lib/format";
import { useNavigate } from "react-router-dom";
import { useMetas } from "@/hooks/useMetas";
import { useInView } from "@/hooks/useInView";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardData } from "@/pages/dashboard/hooks/useDashboardData";
import { useDashboardKpis } from "@/pages/dashboard/hooks/useDashboardKpis";
import { useDashboardDrawerData } from "@/pages/dashboard/hooks/useDashboardDrawerData";
import { useDashboardLayout, type WidgetId } from "@/hooks/useDashboardLayout";
import { DashboardCustomizeMenu } from "@/components/dashboard/DashboardCustomizeMenu";
import { buildDrilldownUrl } from "@/lib/dashboard/drilldown";
import { ScopeBadge } from "@/components/dashboard/ScopeBadge";

const VendasChart = lazy(() =>
  import("@/components/dashboard/VendasChart").then((m) => ({ default: m.VendasChart })),
);

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function formatVencimentosHoje(receber: number, pagar: number): string {
  if (receber === 0 && pagar === 0) return "Sem vencimentos para hoje.";
  const partes: string[] = [];
  if (receber > 0) partes.push(`${receber} recebimento${receber > 1 ? "s" : ""}`);
  if (pagar > 0) partes.push(`${pagar} pagamento${pagar > 1 ? "s" : ""}`);
  return `Você tem ${partes.join(" e ")} vencendo hoje.`;
}

function LazyInViewWidget({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.05 });
  return (
    <div ref={ref}>
      {inView ? children : (fallback ?? <Skeleton className="h-[220px] w-full rounded-xl" />)}
    </div>
  );
}

const DashboardContent = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { metas } = useMetas();
  const { prefs, toggleVisibility, moveWidget, resetLayout } = useDashboardLayout(user?.id);
  const isVisible = (id: WidgetId) => !prefs.hidden.includes(id);

  const [metricDrawer, setMetricDrawer] = useState<null | "receber" | "pagar" | "saldo" | "estoque">(null);

  const {
    stats,
    loading,
    loadedAt,
    loadData,
    backlogOVs,
    backlogOVsCount,
    comprasAguardando,
    comprasAtrasadasCount,
    dailyPagar,
    dailyReceber,
    dailyVendas,
    estoqueBaixo,
    faturamento,
    fiscalStats,
    recentOrcamentos,
    remessasAtrasadas,
    ticketMedio,
    topClientes,
    topProdutos,
    valorEstoque,
    vencimentosHoje,
  } = useDashboardData();

  // React Query handles fetching/caching automatically — no useEffect needed.
  const greeting = getGreeting();

  const { kpiCards, operationalCards, saldoProjetado } = useDashboardKpis({
    metas,
    stats,
    estoqueBaixoCount: estoqueBaixo.length,
    backlogOVsCount,
    comprasAtrasadasCount,
    remessasAtrasadasCount: remessasAtrasadas,
    dailyReceber,
    dailyPagar,
    onOpenReceber: () => navigate(buildDrilldownUrl({ kind: "financeiro:receber-aberto" })),
    onOpenPagar: () => navigate(buildDrilldownUrl({ kind: "financeiro:pagar-aberto" })),
    onOpenSaldo: () => navigate(buildDrilldownUrl({ kind: "financeiro:saldo" })),
    onOpenEstoque: () => navigate(buildDrilldownUrl({ kind: "estoque:critico" })),
    onOpenBacklog: () => navigate(buildDrilldownUrl({ kind: "pedidos:aguardando-faturamento" })),
    onOpenCompras: () => navigate(buildDrilldownUrl({ kind: "compras:atrasadas" })),
    onOpenRemessas: () => navigate(buildDrilldownUrl({ kind: "logistica:remessas-atrasadas" })),
    onReceberDetail: () => setMetricDrawer("receber"),
    onPagarDetail: () => setMetricDrawer("pagar"),
    onSaldoDetail: () => setMetricDrawer("saldo"),
    onEstoqueDetail: () => setMetricDrawer("estoque"),
  });

  const detailData = useDashboardDrawerData({
    dailyReceber,
    dailyPagar,
    topClientes,
    estoqueBaixo,
    dailyVendas,
    topProdutos,
  });

  if (loading) {
    return (
      <><DashboardSkeleton />
      </>
    );
  }

  const openMetric = metricDrawer ? detailData[metricDrawer] : null;

  return (
    <><DashboardHeader
        lastUpdated={loadedAt}
        onRefresh={loadData}
        rightSlot={
          <DashboardCustomizeMenu
            prefs={prefs}
            onToggle={toggleVisibility}
            onMove={moveWidget}
            onReset={resetLayout}
          />
        }
      />

      <div className="mb-4 rounded-lg border border-border/60 bg-muted/10 px-4 py-3">
        <p className="text-sm font-medium text-foreground">
          {greeting}, {profile?.nome?.split(" ")[0] || "time"} 👋
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatVencimentosHoje(vencimentosHoje.receber, vencimentosHoje.pagar)}
          {backlogOVsCount > 0 && ` · ${backlogOVsCount} pedido${backlogOVsCount > 1 ? "s" : ""} aguardando faturamento.`}
        </p>
      </div>

      <div className="space-y-4">
        {isVisible("kpis") && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-live="polite" aria-atomic="false">
            {kpiCards.map((c) => (
              <SummaryCard key={c.id} {...c} density="compact" />
            ))}
          </div>
        )}

        {isVisible("operational") && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Exceções operacionais
              </p>
              <ScopeBadge scope={{ kind: "snapshot" }} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-live="polite" aria-atomic="false">
              {operationalCards.map((c) => (
                <SummaryCard key={c.id} {...c} density="compact" />
              ))}
            </div>
          </div>
        )}

        {isVisible("alertas") && (
          <AlertStrip
            titulosVencidos={stats.contasVencidas}
            estoqueBaixo={estoqueBaixo.length}
            remessasAtrasadas={remessasAtrasadas}
            comprasAtrasadas={comprasAtrasadasCount}
            notasPendentes={fiscalStats.pendentes}
            ovsPendentes={backlogOVsCount}
          />
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {isVisible("financeiro") && <BlockErrorBoundary label="Financeiro">
              <FinanceiroBlock
                totalReceber={stats.totalReceber}
                totalPagar={stats.totalPagar}
                contasVencidas={stats.contasVencidas}
                saldoProjetado={saldoProjetado}
                recebimentosHoje={vencimentosHoje.receber}
                pagamentosHoje={vencimentosHoje.pagar}
              />
            </BlockErrorBoundary>}
          </div>
          <div>
            {isVisible("acoes_rapidas") && <BlockErrorBoundary label="Ações Rápidas">
              <QuickActions />
            </BlockErrorBoundary>}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {isVisible("vendas_chart") && <LazyInViewWidget fallback={<Skeleton className="h-[240px] w-full rounded-xl" />}>
            <DashboardCard>
              <BlockErrorBoundary label="Gráfico de Vendas">
                <Suspense fallback={<Skeleton className="h-[200px] w-full" />}>
                  <div className="h-[200px]">
                    <VendasChart
                      onBarClick={(start, end) =>
                        navigate(`/relatorios?tipo=vendas&di=${start}&df=${end}`)
                      }
                    />
                  </div>
                </Suspense>
              </BlockErrorBoundary>
            </DashboardCard>
          </LazyInViewWidget>}
          {isVisible("pendencias") && <DashboardCard>
            <BlockErrorBoundary label="Pendências">
              <PendenciasList />
            </BlockErrorBoundary>
          </DashboardCard>}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {isVisible("comercial") && <BlockErrorBoundary label="Comercial">
            <ComercialBlock
              cotacoesAbertas={stats.orcamentos}
              pedidosPendentes={backlogOVsCount}
              ticketMedio={ticketMedio}
              recentOrcamentos={recentOrcamentos}
              loading={loading}
              faturamentoMesAtual={faturamento.mesAtual}
              faturamentoMesAnterior={faturamento.mesAnterior}
            />
          </BlockErrorBoundary>}
          {isVisible("estoque") && <BlockErrorBoundary label="Estoque">
            <EstoqueBlock
              itensBaixoMinimo={estoqueBaixo}
              valorTotalEstoque={valorEstoque}
              totalProdutosAtivos={stats.produtos}
            />
          </BlockErrorBoundary>}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {isVisible("logistica") && <LazyInViewWidget fallback={<Skeleton className="h-[220px] w-full rounded-xl" />}>
            <BlockErrorBoundary label="Logística">
              <LogisticaBlock
                comprasAguardando={comprasAguardando}
                totalRemessasAtrasadas={remessasAtrasadas}
              />
            </BlockErrorBoundary>
          </LazyInViewWidget>}
          {isVisible("fiscal") && <LazyInViewWidget fallback={<Skeleton className="h-[220px] w-full rounded-xl" />}>
            <BlockErrorBoundary label="Fiscal">
              <FiscalBlock stats={fiscalStats} />
            </BlockErrorBoundary>
          </LazyInViewWidget>}
        </div>
      </div>

      <ViewDrawerV2
        open={!!metricDrawer}
        onClose={() => setMetricDrawer(null)}
        title={openMetric?.title || "Detalhes"}
        tabs={
          openMetric
            ? [
                {
                  value: "evolucao",
                  label: "Evolução diária",
                  content: (
                    <div className="space-y-3">
                      {openMetric.daily.length > 0 ? (
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={[...openMetric.daily]}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="dia" />
                              <YAxis />
                              <Tooltip formatter={(v: number) => formatCurrency(v)} />
                              <Line dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                          Sem dados para o período selecionado.
                        </p>
                      )}
                      {metricDrawer === "receber" && (
                        <div className="text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setMetricDrawer(null);
                              navigate("/financeiro?tipo=receber");
                            }}
                            className="text-xs text-primary underline-offset-2 hover:underline"
                          >
                            Ver todos os títulos →
                          </button>
                        </div>
                      )}
                      {metricDrawer === "pagar" && (
                        <div className="text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setMetricDrawer(null);
                              navigate(buildDrilldownUrl({ kind: "financeiro:pagar-aberto" }));
                            }}
                            className="text-xs text-primary underline-offset-2 hover:underline"
                          >
                            Ver todos os títulos →
                          </button>
                        </div>
                      )}
                      {metricDrawer === "saldo" && (
                        <div className="text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setMetricDrawer(null);
                              navigate("/fluxo-caixa");
                            }}
                            className="text-xs text-primary underline-offset-2 hover:underline"
                          >
                            Abrir fluxo de caixa →
                          </button>
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  value: "top",
                  label: "Top itens",
                  content: (
                    <div className="space-y-3">
                      {openMetric.top.length > 0 ? (
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[...openMetric.top]}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                              <YAxis />
                              <Tooltip formatter={(v: number) => formatCurrency(v)} />
                              <Bar dataKey="valor" fill="hsl(var(--primary))" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                          Sem dados disponíveis.
                        </p>
                      )}
                      {metricDrawer === "estoque" && (
                        <div className="text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setMetricDrawer(null);
                              navigate("/estoque");
                            }}
                            className="text-xs text-primary underline-offset-2 hover:underline"
                          >
                            Ver estoque completo →
                          </button>
                        </div>
                      )}
                    </div>
                  ),
                },
              ]
            : []
        }
      />
    </>
  );
};

const Dashboard = () => (
  <DashboardPeriodProvider>
    <DashboardContent />
  </DashboardPeriodProvider>
);

export default Dashboard;
