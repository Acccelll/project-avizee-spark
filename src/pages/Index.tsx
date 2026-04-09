import { useEffect, useMemo, useState, useCallback } from "react";
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
import { ViewDrawerV2 } from "@/components/ViewDrawerV2";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardPeriodProvider, useDashboardPeriod } from "@/contexts/DashboardPeriodContext";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatNumber } from "@/lib/format";
import { TrendingUp, DollarSign, Package, BarChart2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const DashboardContent = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { range: globalRange } = useDashboardPeriod();

  const [metricDrawer, setMetricDrawer] = useState<null | "receber" | "estoque" | "vendas">(null);
  const [loadedAt, setLoadedAt] = useState<Date>(new Date());

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
        .select("valor")
        .eq("tipo", tipo as any)
        .eq("ativo", true)
        .in("status", ["aberto", "vencido"]);
      if (dateTo) q = q.lte("data_vencimento", dateTo);
      return q;
    };

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

    const totalReceber = (receber || []).reduce((s: number, r: any) => s + Number(r.valor || 0), 0);
    const totalPagar = (pagar || []).reduce((s: number, r: any) => s + Number(r.valor || 0), 0);

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
    setLoading(false);
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
      sparklineData: [44, 50, 53, 52, 61, 66, 69],
      onClick: () => navigate("/financeiro?tipo=receber"),
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
      sparklineData: [35, 38, 37, 39, 41, 43, 42],
      onClick: () => navigate("/financeiro?tipo=pagar"),
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
      sparklineData: [20, 22, 25, 23, 28, 30, saldoProjetado > 0 ? 35 : 12],
      onClick: () => navigate("/fluxo-caixa"),
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
      sparklineData: [18, 17, 15, 14, 12, 9, estoqueBaixo.length],
      onClick: () => navigate("/estoque"),
    },
  ];

  const ticketMedio =
    stats.orcamentos > 0 ? faturamento.mesAtual / (stats.orcamentos || 1) : 0;

  const detailData = {
    receber: {
      title: "Total a Receber",
      daily: [
        { dia: "Seg", valor: 12000 },
        { dia: "Ter", valor: 18500 },
        { dia: "Qua", valor: 16200 },
        { dia: "Qui", valor: 21100 },
        { dia: "Sex", valor: 19800 },
      ],
      top: [
        { nome: "Cliente A", valor: 32000 },
        { nome: "Cliente B", valor: 22000 },
        { nome: "Cliente C", valor: 14000 },
      ],
    },
    estoque: {
      title: "Estoque Crítico",
      daily: [
        { dia: "Seg", valor: 17 },
        { dia: "Ter", valor: 16 },
        { dia: "Qua", valor: 15 },
        { dia: "Qui", valor: 13 },
        { dia: "Sex", valor: 12 },
      ],
      top: [
        { nome: "SKU-019", valor: 2 },
        { nome: "SKU-130", valor: 3 },
        { nome: "SKU-512", valor: 4 },
      ],
    },
    vendas: {
      title: "Vendas do Mês",
      daily: [
        { dia: "01", valor: 5000 },
        { dia: "05", valor: 9000 },
        { dia: "10", valor: 11500 },
        { dia: "15", valor: 14000 },
        { dia: "20", valor: 18600 },
      ],
      top: [
        { nome: "Produto X", valor: 43000 },
        { nome: "Produto Y", valor: 26000 },
        { nome: "Produto Z", valor: 18000 },
      ],
    },
  } as const;

  if (loading) {
    return (
      <AppLayout>
        <DashboardSkeleton />
      </AppLayout>
    );
  }

  const openMetric = metricDrawer ? detailData[metricDrawer] : null;

  return (
    <AppLayout>
      {/* ── Header ── */}
      <DashboardHeader
        lastUpdated={loadedAt}
        onRefresh={loadData}
      />

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

      {/* ── KPIs principais ── */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((c) => (
          <SummaryCard key={c.id} {...c} />
        ))}
      </div>

      {/* ── Faixa de alertas operacionais ── */}
      <div className="mb-6">
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
      </div>

      {/* ── Financeiro + Ações rápidas ── */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* On mobile QuickActions appears first (order-1), FinanceiroBlock second (order-2).
            On lg+ the visual order matches the DOM order via explicit lg:order-* */}
        <div className="order-2 lg:order-1 lg:col-span-2">
          <FinanceiroBlock
            totalReceber={stats.totalReceber}
            totalPagar={stats.totalPagar}
            contasVencidas={stats.contasVencidas}
            saldoProjetado={saldoProjetado}
            recebimentosHoje={vencimentosHoje.receber}
            pagamentosHoje={vencimentosHoje.pagar}
          />
        </div>
        <div className="order-1 lg:order-2">
          <QuickActions />
        </div>
      </div>

      {/* ── Comercial + Estoque ── */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ComercialBlock
          cotacoesAbertas={stats.orcamentos}
          pedidosPendentes={backlogOVs.length}
          ticketMedio={ticketMedio}
          recentOrcamentos={recentOrcamentos}
          loading={loading}
        />
        <EstoqueBlock
          itensBaixoMinimo={estoqueBaixo}
          valorTotalEstoque={0}
          totalProdutosAtivos={stats.produtos}
        />
      </div>

      {/* ── Logística + Fiscal ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LogisticaBlock
          comprasAguardando={comprasAguardando}
          totalRemessasAtrasadas={0}
        />
        <FiscalBlock stats={fiscalStats} />
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
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={[...openMetric.daily]}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="dia" />
                          <YAxis />
                          <Tooltip />
                          <Line dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ),
                },
                {
                  value: "top",
                  label: "Top itens",
                  content: (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[...openMetric.top]}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="nome" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="valor" fill="hsl(var(--primary))" />
                        </BarChart>
                      </ResponsiveContainer>
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
