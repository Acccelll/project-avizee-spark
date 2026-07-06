import { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  UserPlus,
  Package,
  ShoppingCart,
  Receipt,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import { quickActions } from '@/lib/navigation';
import { buildDrilldownUrl } from '@/lib/dashboard/drilldown';

const VendasChart = lazy(() =>
  import('@/components/dashboard/VendasChart').then((m) => ({ default: m.VendasChart })),
);

const QUICK_ICONS: Record<string, typeof Plus> = {
  'nova-cotacao': Plus,
  'novo-cliente': UserPlus,
  'novo-produto': Package,
  'novo-pedido-compra': ShoppingCart,
  'nova-nota-saida': Receipt,
  'baixa-financeira': DollarSign,
};

interface Pendencia {
  categoria: string;
  descricao: string;
}

interface DesktopBentoLayoutProps {
  saldoProjetado: number;
  totalReceber: number;
  totalPagar: number;
  contasVencidas: number;
  faturamentoMesAtual: number;
  faturamentoMesAnterior: number;
  estoqueBaixoCount: number;
  comprasAtrasadasCount: number;
  remessasAtrasadasCount: number;
  fiscalPendentes: number;
  backlogOVsCount: number;
}

/**
 * DesktopBentoLayout — composição premium (direção v2) para desktop (lg+).
 * Mosaico 12×6: hero Saldo + Ações + coluna Pendências (wine) + Fluxo +
 * Vendas Chart + Alerta Estoque. Mobile usa layout stackado em Index.tsx.
 */
export function DesktopBentoLayout(props: DesktopBentoLayoutProps) {
  const navigate = useNavigate();
  const {
    saldoProjetado,
    totalReceber,
    totalPagar,
    contasVencidas,
    faturamentoMesAtual,
    faturamentoMesAnterior,
    estoqueBaixoCount,
    comprasAtrasadasCount,
    remessasAtrasadasCount,
    fiscalPendentes,
    backlogOVsCount,
  } = props;

  const deltaFat = faturamentoMesAnterior > 0
    ? ((faturamentoMesAtual - faturamentoMesAnterior) / faturamentoMesAnterior) * 100
    : 0;
  const saldoPositivo = saldoProjetado >= 0;

  const receberTotal = totalReceber + totalPagar || 1;
  const receberPct = Math.min(100, Math.round((totalReceber / receberTotal) * 100));
  const pagarPct = Math.min(100, Math.round((totalPagar / receberTotal) * 100));

  const pendencias: Pendencia[] = [];
  if (fiscalPendentes > 0) pendencias.push({ categoria: 'Fiscal', descricao: `${fiscalPendentes} nota${fiscalPendentes > 1 ? 's' : ''} fiscal aguardando envio` });
  if (remessasAtrasadasCount > 0) pendencias.push({ categoria: 'Logística', descricao: `${remessasAtrasadasCount} remessa${remessasAtrasadasCount > 1 ? 's' : ''} em atraso` });
  if (comprasAtrasadasCount > 0) pendencias.push({ categoria: 'Compras', descricao: `${comprasAtrasadasCount} compra${comprasAtrasadasCount > 1 ? 's' : ''} em atraso` });
  if (contasVencidas > 0) pendencias.push({ categoria: 'Financeiro', descricao: `${contasVencidas} título${contasVencidas > 1 ? 's' : ''} vencido${contasVencidas > 1 ? 's' : ''}` });
  if (backlogOVsCount > 0) pendencias.push({ categoria: 'Comercial', descricao: `${backlogOVsCount} pedido${backlogOVsCount > 1 ? 's' : ''} aguardando faturamento` });
  const pendenciasCriticas = pendencias.length;

  return (
    <div className="hidden lg:grid grid-cols-12 gap-5 stagger-children">
      {/* ── Hero KPI: Saldo Projetado ─────────────────────────────────── */}
      <button
        type="button"
        onClick={() => navigate(buildDrilldownUrl({ kind: 'financeiro:saldo' }))}
        className={cn(
          'group text-left col-span-5 row-span-3 min-h-[320px] flex flex-col justify-between',
          'rounded-3xl p-8 border border-primary/10 bg-[hsl(var(--surface-2))]',
          'shadow-soft hover-lift focus-ring',
        )}
      >
        <div>
          <div className="flex items-center gap-2 mb-6">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-primary/70">
              Visão consolidada
            </span>
          </div>
          <p className="text-secondary/60 text-sm font-medium mb-1">Saldo Projetado</p>
          <p className={cn(
            'font-display text-4xl xl:text-5xl font-bold tracking-tight',
            saldoPositivo ? 'text-secondary' : 'text-destructive',
          )}>
            {formatCurrency(saldoProjetado)}
          </p>
        </div>
        <div className="flex items-end justify-between">
          <div className="space-y-1">
            <p className={cn(
              'text-sm font-semibold flex items-center gap-1',
              deltaFat >= 0 ? 'text-primary' : 'text-destructive',
            )}>
              <TrendingUp className={cn('h-3.5 w-3.5', deltaFat < 0 && 'rotate-180')} />
              {deltaFat >= 0 ? '+' : ''}{deltaFat.toFixed(1)}% vs mês anterior
            </p>
            <p className="text-xs text-muted-foreground">Faturamento {formatCurrency(faturamentoMesAtual)}</p>
          </div>
          <div className="h-16 w-32 flex items-end gap-1" aria-hidden>
            {[40, 60, 50, 80, 100].map((h, i) => (
              <div
                key={i}
                className={cn(
                  'w-full rounded-t-sm transition-all duration-500',
                  i === 4 ? 'bg-primary' : i === 3 ? 'bg-primary/40' : 'bg-primary/20',
                )}
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
      </button>

      {/* ── Ações Rápidas ─────────────────────────────────────────────── */}
      <div className="col-span-4 row-span-2 rounded-3xl p-6 bg-card/60 backdrop-blur-sm border border-border/60 shadow-soft">
        <h3 className="font-display text-sm font-bold text-secondary mb-4">Ações Rápidas</h3>
        <div className="grid grid-cols-3 gap-3">
          {quickActions.slice(0, 6).map((action) => {
            const Icon = QUICK_ICONS[action.id] ?? Plus;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => navigate(action.path)}
                aria-label={action.description}
                className={cn(
                  'group flex flex-col items-center justify-center gap-2 p-3 rounded-2xl',
                  'bg-[hsl(var(--surface-2))] text-secondary',
                  'transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]',
                  'hover:bg-primary hover:text-primary-foreground focus-ring',
                )}
              >
                <Icon className="w-5 h-5 opacity-70 group-hover:opacity-100" />
                <span className="text-[10px] font-bold uppercase tracking-wide text-center leading-tight">
                  {action.title.replace(/^Novo(a)?\s+/, '')}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Pendências (wine, coluna alta) ────────────────────────────── */}
      <div className="col-span-3 row-span-4 rounded-3xl p-6 bg-secondary text-secondary-foreground shadow-elevated flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-display font-bold text-sm tracking-wide">Pendências</h3>
          {pendenciasCriticas > 0 && (
            <span className="bg-primary-foreground/15 text-[10px] px-2 py-0.5 rounded-full uppercase font-bold">
              {pendenciasCriticas} crítico{pendenciasCriticas > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="space-y-3 flex-1 overflow-hidden">
          {pendencias.length === 0 ? (
            <p className="text-sm opacity-70">Sem pendências no momento.</p>
          ) : (
            pendencias.slice(0, 5).map((p, i) => (
              <div
                key={i}
                className="p-4 rounded-2xl bg-primary-foreground/[0.06] border border-primary-foreground/10 hover:bg-primary-foreground/10 transition-colors"
              >
                <p className="text-[11px] opacity-60 mb-1 uppercase tracking-wide">{p.categoria}</p>
                <p className="text-sm font-medium leading-snug">{p.descricao}</p>
              </div>
            ))
          )}
        </div>
        <button
          type="button"
          onClick={() => navigate('/financeiro?venc=vencidos')}
          className="mt-4 w-full py-3 rounded-xl border border-primary-foreground/20 text-xs font-bold uppercase tracking-widest hover:bg-primary-foreground hover:text-secondary transition-all focus-ring"
        >
          Ver tudo
        </button>
      </div>

      {/* ── Fluxo Financeiro ──────────────────────────────────────────── */}
      <div className="col-span-4 row-span-2 rounded-3xl p-6 bg-[hsl(var(--surface-2))] border border-primary/10 shadow-soft flex flex-col justify-between">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-sm font-bold text-secondary">Fluxo Financeiro</h3>
          <button
            type="button"
            onClick={() => navigate('/financeiro')}
            className="text-[10px] font-bold uppercase tracking-wider text-primary hover:underline focus-ring rounded px-1"
          >
            Detalhes
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-sm text-muted-foreground">Contas a Receber</span>
              <span className="text-sm font-bold text-primary tabular-nums">{formatCurrency(totalReceber)}</span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all duration-700" style={{ width: `${receberPct}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-sm text-muted-foreground">Contas a Pagar</span>
              <span className="text-sm font-bold text-secondary tabular-nums">{formatCurrency(totalPagar)}</span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-secondary transition-all duration-700" style={{ width: `${pagarPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Vendas Chart (wide) ───────────────────────────────────────── */}
      <div className="col-span-9 row-span-3 rounded-3xl p-6 xl:p-8 bg-card border border-border/60 shadow-soft">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-display text-lg font-bold text-secondary">Desempenho Comercial</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Volume de vendas nos últimos 6 meses</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-[hsl(var(--surface-2))] text-[10px] font-bold text-primary uppercase tracking-wider">
            Semestral
          </span>
        </div>
        <div className="h-[260px] xl:h-[300px]">
          <Suspense fallback={<Skeleton className="h-full w-full" />}>
            <VendasChart
              onBarClick={(start, end) => navigate(`/relatorios?tipo=vendas&di=${start}&df=${end}`)}
            />
          </Suspense>
        </div>
      </div>

      {/* ── Alerta Estoque Crítico ────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => navigate(buildDrilldownUrl({ kind: 'estoque:critico' }))}
        className={cn(
          'text-left col-span-3 row-span-2 rounded-2xl p-6 shadow-soft hover-lift focus-ring',
          'bg-[hsl(var(--surface-2))] border-l-4 border-l-primary border-y border-r border-border/60',
          'flex flex-col justify-center',
        )}
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-primary/10 text-primary shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-primary uppercase tracking-wide">
              {estoqueBaixoCount > 0 ? 'Estoque crítico' : 'Estoque saudável'}
            </p>
            <p className="text-sm text-secondary font-medium leading-snug mt-1">
              {estoqueBaixoCount > 0
                ? `${estoqueBaixoCount} produto${estoqueBaixoCount > 1 ? 's' : ''} abaixo do nível de segurança`
                : 'Nenhum produto abaixo do mínimo'}
            </p>
            <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
              Ver detalhes <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </button>
    </div>
  );
}
