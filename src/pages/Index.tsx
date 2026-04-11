import { lazy, Suspense, useEffect, useMemo, useRef, useState, useCallback } from "react";
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
import { AppLayout } from "@/components/AppLayout";
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
import { BlockErrorBoundary } from "@/components/dashboard/BlockErrorBoundary";
import { ViewDrawerV2 } from "@/components/ViewDrawerV2";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardPeriodProvider, useDashboardPeriod } from "@/contexts/DashboardPeriodContext";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatNumber } from "@/lib/format";
import { TrendingUp, DollarSign, Package, BarChart2, LayoutDashboard, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { useMetas } from "@/hooks/useMetas";
import { useInView } from "@/hooks/useInView";
import { toast } from "sonner";
import GridLayout from "react-grid-layout";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RGL = GridLayout as any;
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

// Lazy-loaded heavy chart components
const VendasChart = lazy(() =>
  import("@/components/dashboard/VendasChart").then((m) => ({ default: m.VendasChart }))
);

/** Renders children only once the element enters the viewport. */
function LazyInViewWidget({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.05 });
  return (
    <div ref={ref} className="h-full">
      {inView ? children : (fallback ?? <Skeleton className="h-full w-full" />)}
    </div>
  );
}

const DashboardContent = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { range: globalRange } = useDashboardPeriod();

  const { layout, setLayout, resetLayout } = useDashboardLayout(user?.id);
  const { metas } = useMetas();
  const [editMode, setEditMode] = useState(false);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(1200);

  const [metricDrawer, setMetricDrawer] = useState<null | "receber" | "estoque" | "vendas">(null);
  const [loadedAt, setLoadedAt] = useState<Date>(new Date());

  // Measure container width for react-grid-layout responsiveness
  useEffect(() => {
    const el = gridContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setGridWidth(entry.contentRect.width || el.clientWidth);
    });
    observer.observe(el);
    setGridWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  const [stats, setStats] = useState({
    produtos: 0,
    clientes: 0,
    fornecedores: 0,
    orcamentos: 0,
    compras: 0,
    contasReceber: 0,
    contasPagar: 0,
    contasVencidas: 0,
    totalReceber: 0,
    totalPagar: 0,
  });
  const [faturamento, setFaturamento] = useState({ mesAtual: 0, mesAnterior: 0 });
  const [loading, setLoading] = useState(true);
  const [recentOrcamentos, setRecentOrcamentos] = useState<any[]>([]);
  const [backlogOVs, setBacklogOVs] = useState<any[]>([]);
  const [comprasAguardando, setComprasAguardando] = useState<any[]>([]);
  const [estoqueBaixo, setEstoqueBaixo] = useState<any[]>([]);
  const [fiscalStats, setFiscalStats] = useState({ emitidas: 0, pendentes: 0, canceladas: 0, valorEmitidas: 0 });
  const [vencimentosHoje, setVencimentosHoje] = useState({ receber: 0, pagar: 0 });
  const [topClientes, setTopClientes] = useState<{ nome: string; valor: number }[]>([]);
  const [topProdutos, setTopProdutos] = useState<{ nome: string; valor: number }[]>([]);
  const [dailyReceber, setDailyReceber] = useState<{ dia: string; valor: number }[]>([]);
  const [dailyPagar, setDailyPagar] = useState<{ dia: string; valor: number }[]>([]);
  const [dailyVendas, setDailyVendas] = useState<{ dia: string; valor: number }[]>([]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { dateFrom, dateTo } = globalRange;
    const today = new Date().toISOString().slice(0, 10);

    const buildFinTotalQuery = (tipo: string) => {
      let q = supabase
        .from("financeiro_lancamentos")
        .select("valor, saldo_restante, status")
        .eq("tipo", tipo as any)
        .eq("ativo", true)
        .in("status", ["aberto", "vencido", "parcial"]);
      if (dateTo) q = q.lte("data_vencimento", dateTo);
      return q;
    };

    try {
      const [
        { count: produtos },
        { count: clientes },
        { count: fornecedores },
        { count: orcamentos },
        { count: compras },
        { data: receber },
        { data: pagar },
        { data: vencidas },
        { data: orcRecent },
        { data: backlog },
        { data: compAguardando },
        { data: estMin },
        { data: nfAtual },
        { data: nfAnterior },
        { data: nfStats },
        { count: receberHoje },
        { count: pagarHoje },
      ] = await Promise.all([
      supabase.from("produtos").select("*", { count: "exact", head: true }).eq("ativo", true),
      supabase.from("clientes").select("*", { count: "exact", head: true }).eq("ativo", true),
      supabase.from("fornecedores").select("*", { count: "exact", head: true }).eq("ativo", true),
      supabase.from("orcamentos").select("*", { count: "exact", head: true }).eq("ativo", true).gte("data_orcamento", dateFrom),
      supabase.from("pedidos_compra").select("*", { count: "exact", head: true }).eq("ativo", true).gte("data_pedido", dateFrom),
      buildFinTotalQuery("receber"),
      buildFinTotalQuery("pagar"),
      supabase.from("financeiro_lancamentos").select("valor").eq("status", "vencido").eq("ativo", true),
      supabase
        .from("orcamentos")
        .select("id, numero, valor_total, status, data_orcamento, clientes(nome_razao_social)")
        .eq("ativo", true)
        .gte("data_orcamento", dateFrom)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("ordens_venda")
        .select("id, numero, valor_total, data_emissao, data_prometida_despacho, prazo_despacho_dias, status, status_faturamento, clientes(nome_razao_social)")
        .eq("ativo", true)
        .in("status", ["aprovada", "em_separacao"])
        .in("status_faturamento", ["aguardando", "parcial"])
        .order("data_emissao", { ascending: true })
        .limit(15),
      supabase
        .from("pedidos_compra")
        .select("id, numero, valor_total, data_pedido, data_entrega_prevista, fornecedores(nome_razao_social)")
        .eq("ativo", true)
        .in("status", ["aprovado", "enviado_ao_fornecedor", "aguardando_recebimento", "parcialmente_recebido"])
        .is("data_entrega_real", null)
        .order("data_entrega_prevista", { ascending: true })
        .limit(10),
      supabase
        .from("produtos")
        .select("id, nome, codigo_interno, estoque_atual, estoque_minimo, unidade_medida")
        .eq("ativo", true)
        .not("estoque_minimo", "is", null)
        .limit(100),
      (() => {
        const now = new Date();
        const inicioMesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        return supabase
          .from("notas_fiscais")
          .select("valor_total")
          .eq("ativo", true)
          .eq("tipo", "saida")
          .eq("status", "confirmada")
          .gte("data_emissao", inicioMesAtual);
      })(),
      (() => {
        const now = new Date();
        const inicioMesAnterior = (() => {
          const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
        })();
        const fimMesAnterior = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        return supabase
          .from("notas_fiscais")
          .select("valor_total")
          .eq("ativo", true)
          .eq("tipo", "saida")
          .eq("status", "confirmada")
          .gte("data_emissao", inicioMesAnterior)
          .lt("data_emissao", fimMesAnterior);
      })(),
      // Fiscal stats for current month
      (() => {
        const now = new Date();
        const inicioMes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        return supabase
          .from("notas_fiscais")
          .select("status, valor_total")
          .eq("ativo", true)
          .gte("data_emissao", inicioMes);
      })(),
      // Recebimentos com vencimento hoje
      supabase
        .from("financeiro_lancamentos")
        .select("id", { count: "exact", head: true })
        .eq("ativo", true)
        .eq("tipo", "receber")
        .eq("status", "aberto")
        .eq("data_vencimento", today),
      // Pagamentos com vencimento hoje
      supabase
        .from("financeiro_lancamentos")
        .select("id", { count: "exact", head: true })
        .eq("ativo", true)
        .eq("tipo", "pagar")
        .eq("status", "aberto")
        .eq("data_vencimento", today),
    ]);

      const totalReceber = (receber || []).reduce((s: number, r: any) => {
        // For partially paid items, use saldo_restante instead of valor
        const val = r.status === "parcial"
          ? Number(r.saldo_restante ?? r.valor ?? 0)
          : Number(r.valor || 0);
        return s + val;
      }, 0);
      const totalPagar = (pagar || []).reduce((s: number, r: any) => {
        const val = r.status === "parcial"
          ? Number(r.saldo_restante ?? r.valor ?? 0)
          : Number(r.valor || 0);
        return s + val;
      }, 0);

      setStats({
        produtos: produtos || 0,
        clientes: clientes || 0,
        fornecedores: fornecedores || 0,
        orcamentos: orcamentos || 0,
        compras: compras || 0,
        totalReceber,
        totalPagar,
        contasVencidas: (vencidas || []).length,
        contasReceber: (receber || []).length,
        contasPagar: (pagar || []).length,
      });

      const fatAtual = (nfAtual || []).reduce((s: number, n: any) => s + Number(n.valor_total || 0), 0);
      const fatAnterior = (nfAnterior || []).reduce((s: number, n: any) => s + Number(n.valor_total || 0), 0);
      setFaturamento({ mesAtual: fatAtual, mesAnterior: fatAnterior });

      // Fiscal stats
      const nfArr = nfStats || [];
      const emitidas = nfArr.filter((n: any) => n.status === "confirmada").length;
      const pendentes = nfArr.filter((n: any) => n.status === "pendente" || n.status === "rascunho").length;
      const canceladas = nfArr.filter((n: any) => n.status === "cancelada").length;
      const valorEmitidas = nfArr
        .filter((n: any) => n.status === "confirmada")
        .reduce((s: number, n: any) => s + Number(n.valor_total || 0), 0);
      setFiscalStats({ emitidas, pendentes, canceladas, valorEmitidas });

      setRecentOrcamentos(orcRecent || []);
      setBacklogOVs(backlog || []);
      setComprasAguardando(compAguardando || []);
      setEstoqueBaixo(
        (estMin || []).filter((p: any) => p.estoque_minimo > 0 && (p.estoque_atual ?? 0) <= p.estoque_minimo)
      );
      setVencimentosHoje({ receber: receberHoje || 0, pagar: pagarHoje || 0 });
      setLoadedAt(new Date());

      // Load top-5 clients by open receivables (fire & forget — non-critical)
      supabase
        .from("financeiro_lancamentos")
        .select("valor, saldo_restante, status, clientes(nome_razao_social)")
        .eq("tipo", "receber")
        .eq("ativo", true)
        .in("status", ["aberto", "vencido", "parcial"])
        .then(({ data: recData }) => {
          if (!recData) return;
          const map = new Map<string, number>();
          for (const r of recData as any[]) {
            const nome: string = r.clientes?.nome_razao_social ?? "Sem cliente";
            const val = r.status === "parcial"
              ? Number(r.saldo_restante ?? r.valor ?? 0)
              : Number(r.valor ?? 0);
            map.set(nome, (map.get(nome) ?? 0) + val);
          }
          const sorted = [...map.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([nome, valor]) => ({ nome, valor }));
          setTopClientes(sorted);
        });

      // Load top-5 products by NF-e sales this month (fire & forget — non-critical)
      const inicioMes = (() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      })();
      supabase
        .from("notas_fiscais_itens")
        .select("quantidade, valor_unitario, produtos(nome), notas_fiscais!inner(status, tipo, data_emissao)")
        .eq("notas_fiscais.status", "confirmada" as any)
        .eq("notas_fiscais.tipo", "saida" as any)
        .gte("notas_fiscais.data_emissao", inicioMes as any)
        .then(({ data: itemData }) => {
          if (!itemData) return;
          const map = new Map<string, number>();
          for (const it of itemData as any[]) {
            const nome: string = it.produtos?.nome ?? "Sem produto";
            const val = Number(it.quantidade ?? 0) * Number(it.valor_unitario ?? 0);
            map.set(nome, (map.get(nome) ?? 0) + val);
          }
          const sorted = [...map.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([nome, valor]) => ({ nome, valor }));
          setTopProdutos(sorted);
        });

      // --- 7-day daily data for sparklines + detail drawers ---
      const buildDays = (fromOffset: number, count: number): string[] =>
        Array.from({ length: count }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() + fromOffset + i);
          return d.toISOString().slice(0, 10);
        });

      const fmt = (iso: string) => {
        const [, mm, dd] = iso.split("-");
        return `${dd}/${mm}`;
      };

      // Receivables: next 7 days (today … today+6)
      const nextDays = buildDays(0, 7);
      supabase
        .from("financeiro_lancamentos")
        .select("data_vencimento, valor, saldo_restante, status")
        .eq("tipo", "receber")
        .eq("ativo", true)
        .in("status", ["aberto", "vencido", "parcial"])
        .in("data_vencimento", nextDays)
        .then(({ data: dr }) => {
          if (!dr) return;
          const map = new Map<string, number>(nextDays.map((d) => [d, 0]));
          for (const r of dr as any[]) {
            const val = r.status === "parcial"
              ? Number(r.saldo_restante ?? r.valor ?? 0)
              : Number(r.valor ?? 0);
            map.set(r.data_vencimento, (map.get(r.data_vencimento) ?? 0) + val);
          }
          setDailyReceber(nextDays.map((d) => ({ dia: fmt(d), valor: map.get(d) ?? 0 })));
        });

      // Payables: next 7 days
      supabase
        .from("financeiro_lancamentos")
        .select("data_vencimento, valor, saldo_restante, status")
        .eq("tipo", "pagar")
        .eq("ativo", true)
        .in("status", ["aberto", "vencido", "parcial"])
        .in("data_vencimento", nextDays)
        .then(({ data: dp }) => {
          if (!dp) return;
          const map = new Map<string, number>(nextDays.map((d) => [d, 0]));
          for (const r of dp as any[]) {
            const val = r.status === "parcial"
              ? Number(r.saldo_restante ?? r.valor ?? 0)
              : Number(r.valor ?? 0);
            map.set(r.data_vencimento, (map.get(r.data_vencimento) ?? 0) + val);
          }
          setDailyPagar(nextDays.map((d) => ({ dia: fmt(d), valor: map.get(d) ?? 0 })));
        });

      // Vendas: last 7 days NF-e saída confirmed
      const lastDays = buildDays(-6, 7);
      supabase
        .from("notas_fiscais")
        .select("data_emissao, valor_total")
        .eq("ativo", true)
        .eq("tipo", "saida")
        .eq("status", "confirmada")
        .in("data_emissao", lastDays)
        .then(({ data: dv }) => {
          if (!dv) return;
          const map = new Map<string, number>(lastDays.map((d) => [d, 0]));
          for (const n of dv as any[]) {
            map.set(n.data_emissao, (map.get(n.data_emissao) ?? 0) + Number(n.valor_total ?? 0));
          }
          setDailyVendas(lastDays.map((d) => ({ dia: fmt(d), valor: map.get(d) ?? 0 })));
        });
    } catch (err) {
      console.error("[dashboard] erro ao carregar dados:", err);
      toast.error("Erro ao carregar dados do dashboard. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [globalRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saldoProjetado = stats.totalReceber - stats.totalPagar;

  const kpiCards = [
    {
      id: "receber",
      title: "Contas a Receber",
      value: formatCurrency(stats.totalReceber),
      subtitle: `${formatNumber(stats.contasReceber)} título${stats.contasReceber !== 1 ? "s" : ""} em aberto`,
      icon: TrendingUp,
      variation: stats.contasVencidas > 0 ? `${stats.contasVencidas} vencido${stats.contasVencidas > 1 ? "s" : ""}` : "Sem vencidos",
      variationType: stats.contasVencidas > 0 ? ("negative" as const) : ("positive" as const),
      variant: stats.contasVencidas > 0 ? ("warning" as const) : ("success" as const),
      sparklineData: dailyReceber.length > 0 ? dailyReceber.map((d) => d.valor) : undefined,
      onClick: () => navigate("/financeiro?tipo=receber"),
      onDetail: () => setMetricDrawer("receber"),
      meta: metas.receber,
      realizado: stats.totalReceber,
    },
    {
      id: "pagar",
      title: "Contas a Pagar",
      value: formatCurrency(stats.totalPagar),
      subtitle: `${formatNumber(stats.contasPagar)} título${stats.contasPagar !== 1 ? "s" : ""} em aberto`,
      icon: DollarSign,
      variation: stats.totalPagar > stats.totalReceber ? "Saldo negativo" : "Saldo positivo",
      variationType: stats.totalPagar > stats.totalReceber ? ("negative" as const) : ("positive" as const),
      variant: stats.totalPagar > stats.totalReceber ? ("danger" as const) : ("warning" as const),
      sparklineData: dailyPagar.length > 0 ? dailyPagar.map((d) => d.valor) : undefined,
      onClick: () => navigate("/financeiro?tipo=pagar"),
      meta: metas.pagar,
      realizado: stats.totalPagar,
    },
    {
      id: "saldo",
      title: "Saldo Projetado",
      value: formatCurrency(saldoProjetado),
      subtitle: "receber − pagar",
      icon: BarChart2,
      variation: saldoProjetado >= 0 ? "Caixa positivo" : "Caixa negativo",
      variationType: saldoProjetado >= 0 ? ("positive" as const) : ("negative" as const),
      variant: saldoProjetado >= 0 ? ("success" as const) : ("danger" as const),
      sparklineData:
        dailyReceber.length > 0 && dailyPagar.length > 0
          ? dailyReceber.map((r, i) => r.valor - (dailyPagar[i]?.valor ?? 0))
          : undefined,
      onClick: () => navigate("/fluxo-caixa"),
      meta: metas.saldo,
      realizado: saldoProjetado,
    },
    {
      id: "estoque",
      title: "Estoque Crítico",
      value: formatNumber(estoqueBaixo.length),
      subtitle: estoqueBaixo.length > 0 ? "produto(s) abaixo do mínimo" : "Estoque dentro do normal",
      icon: Package,
      variation: estoqueBaixo.length > 0 ? "Reposição necessária" : "Sem itens críticos",
      variationType: estoqueBaixo.length > 0 ? ("negative" as const) : ("positive" as const),
      variant: estoqueBaixo.length > 0 ? ("danger" as const) : ("success" as const),
      sparklineData: undefined,
      onClick: () => navigate("/estoque"),
      onDetail: () => setMetricDrawer("estoque"),
    },
  ];

  const ticketMedio =
    stats.orcamentos > 0 ? faturamento.mesAtual / (stats.orcamentos || 1) : 0;

  const detailData = {
    receber: {
      title: "Vencimentos dos Próximos 7 Dias",
      daily: dailyReceber,
      top: topClientes,
    },
    estoque: {
      title: "Estoque Crítico",
      daily: [] as { dia: string; valor: number }[],
      top: estoqueBaixo.slice(0, 5).map((p: any) => ({
        nome: p.codigo_interno ? `${p.codigo_interno} – ${p.nome}` : p.nome,
        valor: p.estoque_atual ?? 0,
      })),
    },
    vendas: {
      title: "Vendas dos Últimos 7 Dias",
      daily: dailyVendas,
      top: topProdutos,
    },
  };

  if (loading) {
    return (
      <AppLayout>
        <DashboardSkeleton />
      </AppLayout>
    );
  }

  const openMetric = metricDrawer ? detailData[metricDrawer] : null;

  // Widget container used inside the grid
  const W = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div className={`h-full overflow-auto ${className}`}>{children}</div>
  );

  return (
    <AppLayout>
      {/* ── Header ── */}
      <DashboardHeader lastUpdated={loadedAt} onRefresh={loadData} />

      {/* ── Edit mode toolbar ── */}
      <div className="mb-3 flex items-center justify-end gap-2">
        <Button
          size="sm"
          variant={editMode ? "default" : "outline"}
          className="h-7 gap-1.5 text-xs"
          onClick={() => setEditMode((v) => !v)}
        >
          <LayoutDashboard className="h-3.5 w-3.5" />
          {editMode ? "Salvar layout" : "Editar layout"}
        </Button>
        {editMode && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs text-muted-foreground"
            onClick={() => { resetLayout(); setEditMode(false); }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar padrão
          </Button>
        )}
      </div>

      {/* ── Saudação contextual ── */}
      <div className="mb-4 rounded-lg border border-border/60 bg-muted/10 px-4 py-3">
        <p className="text-sm font-medium text-foreground">
          {greeting}, {profile?.nome?.split(" ")[0] || "time"} 👋
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {vencimentosHoje.receber > 0 || vencimentosHoje.pagar > 0
            ? `Você tem ${vencimentosHoje.receber > 0 ? `${vencimentosHoje.receber} recebimento${vencimentosHoje.receber > 1 ? "s" : ""}` : ""}${
                vencimentosHoje.receber > 0 && vencimentosHoje.pagar > 0 ? " e " : ""
              }${vencimentosHoje.pagar > 0 ? `${vencimentosHoje.pagar} pagamento${vencimentosHoje.pagar > 1 ? "s" : ""}` : ""} vencendo hoje.`
            : "Sem vencimentos para hoje."}
          {backlogOVs.length > 0 && ` · ${backlogOVs.length} pedido${backlogOVs.length > 1 ? "s" : ""} aguardando faturamento.`}
        </p>
      </div>

      {/* ── Drag-and-drop grid ── */}
      <div ref={gridContainerRef}>
      <RGL
        layout={layout}
        cols={12}
        rowHeight={40}
        width={gridWidth}
        isDraggable={editMode}
        isResizable={editMode}
        onLayoutChange={(newLayout: any) => { if (editMode) setLayout(newLayout); }}
        className={editMode ? "react-grid-layout--edit" : ""}
        draggableHandle=".drag-handle"
      >
        {/* KPIs */}
        <div key="kpis">
          <W>
            <div className="grid grid-cols-1 gap-4 h-full sm:grid-cols-2 lg:grid-cols-4">
              {kpiCards.map((c) => (
                <SummaryCard key={c.id} {...c} />
              ))}
            </div>
          </W>
        </div>

        {/* Alertas */}
        <div key="alertas">
          <W>
            <AlertStrip
              titulosVencidos={stats.contasVencidas}
              estoqueBaixo={estoqueBaixo.length}
              remessasAtrasadas={0}
              comprasAguardando={comprasAguardando.filter((c) => {
                if (!c.data_entrega_prevista) return false;
                return new Date(c.data_entrega_prevista) < new Date();
              }).length}
              notasPendentes={fiscalStats.pendentes}
              ovsPendentes={backlogOVs.length}
            />
          </W>
        </div>

        {/* Financeiro */}
        <div key="financeiro">
          <W>
            <BlockErrorBoundary label="Financeiro">
              <FinanceiroBlock
                totalReceber={stats.totalReceber}
                totalPagar={stats.totalPagar}
                contasVencidas={stats.contasVencidas}
                saldoProjetado={saldoProjetado}
                recebimentosHoje={vencimentosHoje.receber}
                pagamentosHoje={vencimentosHoje.pagar}
              />
            </BlockErrorBoundary>
          </W>
        </div>

        {/* Ações rápidas */}
        <div key="acoes_rapidas">
          <W>
            <BlockErrorBoundary label="Ações Rápidas">
              <QuickActions />
            </BlockErrorBoundary>
          </W>
        </div>

        {/* Vendas chart — lazy + inView */}
        <div key="vendas_chart">
          <LazyInViewWidget fallback={<Skeleton className="h-full w-full" />}>
            <div className="bg-card rounded-xl border p-4 h-full">
              <BlockErrorBoundary label="Gráfico de Vendas">
                <Suspense fallback={<Skeleton className="h-full w-full" />}>
                  <VendasChart
                    onBarClick={(start, end) =>
                      navigate(`/relatorios?tipo=vendas&di=${start}&df=${end}`)
                    }
                  />
                </Suspense>
              </BlockErrorBoundary>
            </div>
          </LazyInViewWidget>
        </div>

        {/* Pendências */}
        <div key="pendencias">
          <W>
            <div className="bg-card rounded-xl border p-4 h-full">
              <BlockErrorBoundary label="Pendências">
                <PendenciasList />
              </BlockErrorBoundary>
            </div>
          </W>
        </div>

        {/* Comercial */}
        <div key="comercial">
          <W>
            <BlockErrorBoundary label="Comercial">
              <ComercialBlock
                cotacoesAbertas={stats.orcamentos}
                pedidosPendentes={backlogOVs.length}
                ticketMedio={ticketMedio}
                recentOrcamentos={recentOrcamentos}
                loading={loading}
              />
            </BlockErrorBoundary>
          </W>
        </div>

        {/* Estoque */}
        <div key="estoque">
          <W>
            <BlockErrorBoundary label="Estoque">
              <EstoqueBlock
                itensBaixoMinimo={estoqueBaixo}
                valorTotalEstoque={0}
                totalProdutosAtivos={stats.produtos}
              />
            </BlockErrorBoundary>
          </W>
        </div>

        {/* Logística */}
        <div key="logistica">
          <LazyInViewWidget fallback={<Skeleton className="h-full w-full" />}>
            <BlockErrorBoundary label="Logística">
              <LogisticaBlock
                comprasAguardando={comprasAguardando}
                totalRemessasAtrasadas={0}
              />
            </BlockErrorBoundary>
          </LazyInViewWidget>
        </div>

        {/* Fiscal */}
        <div key="fiscal">
          <LazyInViewWidget fallback={<Skeleton className="h-full w-full" />}>
            <BlockErrorBoundary label="Fiscal">
              <FiscalBlock stats={fiscalStats} />
            </BlockErrorBoundary>
          </LazyInViewWidget>
        </div>
      </RGL>
      </div>

      {/* ── Drawer de detalhes por métrica ── */}
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
                            onClick={() => { setMetricDrawer(null); navigate("/financeiro?tipo=receber"); }}
                            className="text-xs text-primary underline-offset-2 hover:underline"
                          >
                            Ver todos os títulos →
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
                            onClick={() => { setMetricDrawer(null); navigate("/estoque"); }}
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
    </AppLayout>
  );
};

const Dashboard = () => (
  <DashboardPeriodProvider>
    <DashboardContent />
  </DashboardPeriodProvider>
);

export default Dashboard;
