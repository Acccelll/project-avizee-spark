import { Fragment, lazy, Suspense, useState, type ReactNode } from "react";
import { SummaryCard } from "@/components/SummaryCard";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MobileDashboardHeader } from "@/components/dashboard/MobileDashboardHeader";
import { MobileCollapsibleBlock } from "@/components/dashboard/MobileCollapsibleBlock";
import { BackToTopButton } from "@/components/dashboard/BackToTopButton";
import { AlertStrip } from "@/components/dashboard/AlertStrip";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { FinanceiroBlock } from "@/components/dashboard/FinanceiroBlock";
import { ComercialBlock } from "@/components/dashboard/ComercialBlock";
import { EstoqueBlock } from "@/components/dashboard/EstoqueBlock";
import { LogisticaBlock } from "@/components/dashboard/LogisticaBlock";
import { FiscalBlock } from "@/components/dashboard/FiscalBlock";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { MobileDashboardSkeleton } from "@/components/dashboard/MobileDashboardSkeleton";
import { PendenciasList } from "@/components/dashboard/PendenciasList";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { BlockErrorBoundary } from "@/components/dashboard/BlockErrorBoundary";
import { KpiDetailDrawer, type KpiMetricKey } from "@/components/dashboard/KpiDetailDrawer";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useMetas } from "@/hooks/useMetas";
import { useInView } from "@/hooks/useInView";
import { useIsMobile } from "@/hooks/use-mobile";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardData } from "@/pages/dashboard/hooks/useDashboardData";
import { useDashboardKpis } from "@/pages/dashboard/hooks/useDashboardKpis";
import { useDashboardDrawerData } from "@/pages/dashboard/hooks/useDashboardDrawerData";
import { useDashboardLayout, type WidgetId } from "@/hooks/useDashboardLayout";
import { DashboardCustomizeMenu } from "@/components/dashboard/DashboardCustomizeMenu";
import { buildDrilldownUrl } from "@/lib/dashboard/drilldown";
import { ScopeBadge } from "@/components/dashboard/ScopeBadge";
import { GreetingBanner } from "@/components/dashboard/GreetingBanner";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
import {
  ShoppingBag,
  Package,
  Truck,
  FileText as FileTextIcon,
  DollarSign,
} from "lucide-react";

const VendasChart = lazy(() =>
  import("@/components/dashboard/VendasChart").then((m) => ({ default: m.VendasChart })),
);

function LazyInViewWidget({
  children,
  fallback,
  rootMargin = '0px 0px -80px 0px',
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  rootMargin?: string;
}) {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.1, rootMargin });
  return (
    <div ref={ref}>
      {inView ? children : (fallback ?? <Skeleton className="min-h-[220px] w-full rounded-xl" />)}
    </div>
  );
}

const DashboardContent = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { metas } = useMetas();
  const { prefs, toggleVisibility, reorderWidgets, resetLayout } = useDashboardLayout(user?.id);
  const isVisible = (id: WidgetId) => !prefs.hidden.includes(id);
  const isMobile = useIsMobile();

  const [metricDrawer, setMetricDrawer] = useState<KpiMetricKey | null>(null);

  const {
    stats,
    loading,
    fetching,
    loadedAt,
    loadData,
    backlogOVs,
    backlogOVsCount,
    comprasAguardando,
    comprasAtrasadasCount,
    dailyPagar,
    dailyReceber,
    estoqueBaixo,
    faturamento,
    fiscalStats,
    recentOrcamentos,
    remessasAtrasadas,
    ticketMedio,
    topClientes,
    valorEstoque,
    vencimentosHoje,
    scopes,
  } = useDashboardData();

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
  });

  const ptr = usePullToRefresh({ onRefresh: loadData, disabled: fetching || !isMobile });

  if (loading) {
    return isMobile ? <MobileDashboardSkeleton /> : <DashboardSkeleton />;
  }

  const openMetric = metricDrawer ? detailData[metricDrawer] : null;

  // Compact currency for accordion summaries (e.g. "R$ 12k").
  const fmtK = (n: number): string => {
    const sign = n < 0 ? '-' : '';
    const abs = Math.abs(n);
    if (abs >= 1000) return `${sign}R$ ${Math.round(abs / 1000)}k`;
    return `${sign}R$ ${abs.toFixed(0)}`;
  };

  // ---------------------------------------------------------------------------
  // Renderers map — a função de cada widget é renderizada de acordo com a
  // ordem persistida em `prefs.order`. Isso faz com que reorder no menu
  // "Personalizar" reflita na tela de fato.
  //
  // Widgets que historicamente convivem em uma mesma linha lado-a-lado
  // (financeiro+ações, vendas+pendências, comercial+estoque, logística+fiscal)
  // são "agrupados" via metadado `pair` no registry — quando dois widgets
  // adjacentes pertencem ao mesmo grupo, são renderizados na mesma grid de 2
  // colunas. Caso o usuário reorganize a ordem e quebre o par, cada um vira
  // full-width (comportamento gracioso). Para v1 isso é suficiente.
  // ---------------------------------------------------------------------------

  const RENDERERS: Record<WidgetId, () => ReactNode> = {
    kpis: () => (
      <div
        aria-live="polite"
        aria-atomic="false"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3"
      >
        {kpiCards.map((c, idx) => (
          <div
            key={c.id}
            className={cn(
              'min-w-0',
              idx === kpiCards.length - 1 && kpiCards.length % 2 === 1 && 'col-span-2 sm:col-span-1',
            )}
          >
            <SummaryCard {...c} density="compact" />
          </div>
        ))}
      </div>
    ),
    operational: () => (
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Exceções operacionais
          </p>
          <ScopeBadge scope={{ kind: "snapshot" }} />
        </div>
        <div
          aria-live="polite"
          aria-atomic="false"
          className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3"
        >
          {operationalCards.map((c) => (
            <div key={c.id} className="min-w-0">
              <SummaryCard {...c} density="compact" />
            </div>
          ))}
        </div>
      </div>
    ),
    alertas: () => (
      <AlertStrip
        titulosVencidos={stats.contasVencidas}
        notasPendentes={fiscalStats.pendentes}
        saldoProjetado={saldoProjetado}
        comprasAtrasadas={comprasAtrasadasCount}
        remessasAtrasadas={remessasAtrasadas}
      />
    ),
    financeiro: () => (
      <BlockErrorBoundary label="Financeiro">
        <div data-help-id="dashboard.financeiro">
        <MobileCollapsibleBlock
          title="Financeiro"
          icon={DollarSign}
          iconColor="text-primary"
          summary={
            stats.contasVencidas > 0
              ? `Saldo ${fmtK(saldoProjetado)} · ${stats.contasVencidas} vencido${stats.contasVencidas > 1 ? 's' : ''}`
              : `Saldo ${fmtK(saldoProjetado)}`
          }
          defaultOpen
          persistKey="financeiro"
        >
          <FinanceiroBlock
            totalReceber={stats.totalReceber}
            totalPagar={stats.totalPagar}
            contasVencidas={stats.contasVencidas}
            saldoProjetado={saldoProjetado}
            recebimentosHoje={vencimentosHoje.receber}
            pagamentosHoje={vencimentosHoje.pagar}
            hideHeaderOnMobile={isMobile}
          />
        </MobileCollapsibleBlock>
        </div>
      </BlockErrorBoundary>
    ),
    acoes_rapidas: () => {
      // Quando não está adjacente ao seu par natural, limita a largura para
      // não ocupar full-width sozinho (estética).
      const idx = prefs.order.indexOf('acoes_rapidas');
      const prev = prefs.order[idx - 1];
      const next = prefs.order[idx + 1];
      const groupKey = widgetToGroup.get('acoes_rapidas');
      const isInPair = Boolean(
        (prev && groupKey && widgetToGroup.get(prev) === groupKey && isVisible(prev)) ||
        (next && groupKey && widgetToGroup.get(next) === groupKey && isVisible(next)),
      );
      return (
        <div className={isInPair ? 'hidden md:block' : 'hidden md:block max-w-md'}>
          <BlockErrorBoundary label="Ações Rápidas">
            <QuickActions />
          </BlockErrorBoundary>
        </div>
      );
    },
    vendas_chart: () => (
      <LazyInViewWidget fallback={<Skeleton className="min-h-[240px] w-full rounded-xl" />}>
        <DashboardCard>
          <BlockErrorBoundary label="Gráfico de Vendas">
            <Suspense fallback={<Skeleton className="h-[280px] w-full" />}>
              <div className="h-[260px] md:h-[280px]">
                <VendasChart
                  onBarClick={(start, end) =>
                    navigate(`/relatorios?tipo=vendas&di=${start}&df=${end}`)
                  }
                />
              </div>
            </Suspense>
          </BlockErrorBoundary>
        </DashboardCard>
      </LazyInViewWidget>
    ),
    pendencias: () => (
      <DashboardCard>
        <BlockErrorBoundary label="Pendências">
          <PendenciasList />
        </BlockErrorBoundary>
      </DashboardCard>
    ),
    comercial: () => (
      <BlockErrorBoundary label="Comercial">
        <div data-help-id="dashboard.comercial">
        <MobileCollapsibleBlock
          title="Comercial"
          icon={ShoppingBag}
          iconColor="text-secondary"
          summary={
            faturamento.mesAtual > 0
              ? `${fmtK(faturamento.mesAtual)} · ${stats.orcamentos} orç`
              : `${stats.orcamentos} orç`
          }
          persistKey="comercial"
        >
          <ComercialBlock
            cotacoesAbertas={stats.orcamentos}
            pedidosPendentes={backlogOVsCount}
            ticketMedio={ticketMedio}
            recentOrcamentos={recentOrcamentos}
            loading={loading}
            faturamentoMesAtual={faturamento.mesAtual}
            faturamentoMesAnterior={faturamento.mesAnterior}
            hideHeaderOnMobile={isMobile}
          />
        </MobileCollapsibleBlock>
        </div>
      </BlockErrorBoundary>
    ),
    estoque: () => (
      <BlockErrorBoundary label="Estoque">
        <MobileCollapsibleBlock
          title="Estoque"
          icon={Package}
          iconColor="text-info"
          summary={
            estoqueBaixo.length > 0
              ? `${estoqueBaixo.length} crítico${estoqueBaixo.length > 1 ? 's' : ''}`
              : `${stats.produtos} ativos`
          }
          defaultOpen={estoqueBaixo.length > 0}
          persistKey="estoque"
        >
          <EstoqueBlock
            itensBaixoMinimo={estoqueBaixo}
            valorTotalEstoque={valorEstoque}
            totalProdutosAtivos={stats.produtos}
            hideHeaderOnMobile={isMobile}
          />
        </MobileCollapsibleBlock>
      </BlockErrorBoundary>
    ),
    logistica: () => (
      <LazyInViewWidget fallback={<Skeleton className="min-h-[220px] w-full rounded-xl" />}>
        <BlockErrorBoundary label="Logística">
          <div data-help-id="dashboard.logistica">
          <MobileCollapsibleBlock
            title="Logística"
            icon={Truck}
            iconColor="text-info"
            summary={
              remessasAtrasadas > 0
                ? `${remessasAtrasadas} atrasada${remessasAtrasadas > 1 ? 's' : ''}`
                : 'Sem atrasos'
            }
            persistKey="logistica"
          >
            <LogisticaBlock
              comprasAguardando={comprasAguardando}
              totalRemessasAtrasadas={remessasAtrasadas}
              hideHeaderOnMobile={isMobile}
            />
          </MobileCollapsibleBlock>
          </div>
        </BlockErrorBoundary>
      </LazyInViewWidget>
    ),
    fiscal: () => (
      <LazyInViewWidget fallback={<Skeleton className="min-h-[220px] w-full rounded-xl" />}>
        <BlockErrorBoundary label="Fiscal">
          <div data-help-id="dashboard.fiscal">
          <MobileCollapsibleBlock
            title="Fiscal"
            icon={FileTextIcon}
            iconColor="text-secondary"
            summary={
              fiscalStats.pendentes > 0
                ? `${fiscalStats.pendentes} pendente${fiscalStats.pendentes > 1 ? 's' : ''}`
                : `${fiscalStats.emitidas} emitidas`
            }
            persistKey="fiscal"
          >
            <FiscalBlock stats={fiscalStats} scope={scopes?.fiscal} hideHeaderOnMobile={isMobile} />
          </MobileCollapsibleBlock>
          </div>
        </BlockErrorBoundary>
      </LazyInViewWidget>
    ),
  };

  // Pares "naturais" para layout 2 colunas. Ordem dentro do par é livre.
  const PAIR_GROUPS: Record<string, WidgetId[]> = {
    finRow: ["financeiro", "acoes_rapidas"],
    midRow: ["pendencias", "fiscal"],
    comRow: ["comercial", "vendas_chart"],
    supRow: ["estoque", "logistica"],
  };
  const widgetToGroup = new Map<WidgetId, string>();
  for (const [gid, members] of Object.entries(PAIR_GROUPS)) {
    members.forEach((m) => widgetToGroup.set(m, gid));
  }

  // Specials que sempre ocupam linha inteira independente de vizinhos.
  const FULL_WIDTH = new Set<WidgetId>(["kpis", "operational", "alertas"]);

  // Constrói as linhas conforme prefs.order respeitando os pares.
  const baseVisibleOrder = prefs.order.filter((id) => isVisible(id));
  // Respeita a ordem persistida do usuário em qualquer breakpoint. No mobile
  // os pares caem para 1 coluna naturalmente (lg:grid-cols-2).
  const visibleOrder = baseVisibleOrder;
  const rows: Array<{ key: string; items: WidgetId[]; pair: boolean }> = [];
  let i = 0;
  while (i < visibleOrder.length) {
    const id = visibleOrder[i];
    if (FULL_WIDTH.has(id)) {
      rows.push({ key: `full-${id}`, items: [id], pair: false });
      i += 1;
      continue;
    }
    const group = widgetToGroup.get(id);
    const next = visibleOrder[i + 1];
    if (group && next && widgetToGroup.get(next) === group) {
      rows.push({ key: `pair-${id}-${next}`, items: [id, next], pair: true });
      i += 2;
    } else {
      rows.push({ key: `solo-${id}`, items: [id], pair: false });
      i += 1;
    }
  }

  return (
    <div
      onTouchStart={ptr.handlers.onTouchStart}
      onTouchMove={ptr.handlers.onTouchMove}
      onTouchEnd={ptr.handlers.onTouchEnd}
      style={isMobile && ptr.pullDistance > 0 ? { transform: `translateY(${ptr.pullDistance}px)`, transition: 'transform 0.05s linear' } : undefined}
    >
      {isMobile && (ptr.refreshing || ptr.pullDistance > 0) && (
        <div
          aria-hidden
          className="pointer-events-none fixed left-1/2 z-40 -translate-x-1/2"
          style={{ top: 'calc(var(--app-header-height, 56px) + 4px)' }}
        >
          <div className="rounded-full bg-background/90 p-2 shadow-md">
            <RefreshCw className={cn('h-4 w-4 text-primary', ptr.refreshing && 'animate-spin')} />
          </div>
        </div>
      )}
      {isMobile ? (
        <MobileDashboardHeader
          lastUpdated={loadedAt}
          onRefresh={loadData}
          fetching={fetching}
          rightSlot={
            <DashboardCustomizeMenu
              prefs={prefs}
              onToggle={toggleVisibility}
              onReorder={reorderWidgets}
              onReset={resetLayout}
            />
          }
        />
      ) : (
        <DashboardHeader
          lastUpdated={loadedAt}
          onRefresh={loadData}
          fetching={fetching}
          rightSlot={
            <DashboardCustomizeMenu
              prefs={prefs}
              onToggle={toggleVisibility}
              onReorder={reorderWidgets}
              onReset={resetLayout}
            />
          }
        />
      )}

      <GreetingBanner
        nome={profile?.nome}
        vencimentosHoje={vencimentosHoje}
        backlogOVsCount={backlogOVsCount}
        onNavigateVencimentos={() => navigate(`/financeiro?venc=hoje`)}
        onNavigateBacklog={() => navigate(buildDrilldownUrl({ kind: "pedidos:aguardando-faturamento" }))}
      />

      <div className="space-y-3 md:space-y-4">
        {rows.map((row) => {
          if (row.pair) {
            const isFinRow = row.items[0] === 'financeiro' || row.items[1] === 'financeiro';
            return (
              <div
                key={row.key}
                className={
                  'grid grid-cols-1 gap-4 lg:items-start ' +
                  (isFinRow ? 'lg:grid-cols-[2fr_1fr]' : 'lg:grid-cols-2')
                }
              >
                {row.items.map((id) => (
                  <Fragment key={id}>{RENDERERS[id]()}</Fragment>
                ))}
              </div>
            );
          }
          return <Fragment key={row.key}>{RENDERERS[row.items[0]]()}</Fragment>;
        })}
      </div>

      <KpiDetailDrawer
        metric={metricDrawer}
        payload={openMetric}
        onClose={() => setMetricDrawer(null)}
      />

      <BackToTopButton />
    </div>
  );
};

// O `GlobalPeriodProvider` já é montado em `AppLayout` — não duplicar aqui.
const Dashboard = DashboardContent;

export default Dashboard;
