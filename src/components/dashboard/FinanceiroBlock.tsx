import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, ArrowRight, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FluxoCaixaChart } from './FluxoCaixaChart';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ScopeBadge } from './ScopeBadge';
import { buildDrilldownUrl } from '@/lib/dashboard/drilldown';

interface FinanceiroBlockProps {
  recebimentosHoje: number;
  pagamentosHoje: number;
  /** When true, hides the inner card header on viewports <md (used when wrapped in a MobileCollapsibleBlock). */
  hideHeaderOnMobile?: boolean;
}

export function FinanceiroBlock({
  recebimentosHoje,
  pagamentosHoje,
  hideHeaderOnMobile = false,
}: FinanceiroBlockProps) {
  const navigate = useNavigate();

  return (
    <div className="bg-card rounded-xl border flex flex-col">
      {/* Header */}
      <div
        className={cn(
          'items-center justify-between px-4 pt-4 pb-2 border-b border-border/60 shrink-0',
          hideHeaderOnMobile ? 'hidden md:flex' : 'flex',
        )}
      >
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          Financeiro
          <ScopeBadge scope={{ kind: 'snapshot' }} variant="subtle" />
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-primary hover:text-primary"
          onClick={() => navigate(buildDrilldownUrl({ kind: 'financeiro:receber-aberto' }))}
        >
          Abrir módulo <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Gráfico de fluxo de caixa — embedded (sem card wrapper). Em mobile,
          escondemos o gráfico (ilegível em <375px) e oferecemos um atalho.
          Altura concreta (h-[200px]) é necessária para o ResponsiveContainer
          do recharts resolver `height="100%"` corretamente. */}
      <div className="hidden md:block h-[220px] px-4 py-3">
        <FluxoCaixaChart embedded />
      </div>
      <div className="md:hidden border-t border-border/60 px-4 py-2">
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-full justify-center gap-1.5 text-xs"
          onClick={() => navigate('/fluxo-caixa')}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Ver fluxo de caixa
        </Button>
      </div>

      {/* Vencimentos de hoje */}
      {(recebimentosHoje > 0 || pagamentosHoje > 0) && (
        <div className="flex items-center gap-4 border-t border-border/60 px-4 py-2 shrink-0">
          <span className="text-xs text-muted-foreground font-medium">Hoje:</span>
          {recebimentosHoje > 0 && (
            <span className="flex items-center gap-1 text-xs text-success font-medium">
              <TrendingUp className="h-3 w-3" />
              {formatNumber(recebimentosHoje)} recebimento{recebimentosHoje > 1 ? 's' : ''}
            </span>
          )}
          {pagamentosHoje > 0 && (
            <span className="flex items-center gap-1 text-xs text-destructive font-medium">
              <TrendingDown className="h-3 w-3" />
              {formatNumber(pagamentosHoje)} pagamento{pagamentosHoje > 1 ? 's' : ''}
            </span>
          )}
          <Button
            variant="link"
            size="sm"
            className="ml-auto h-auto p-0 text-xs"
            onClick={() => navigate('/fluxo-caixa')}
          >
            Ver fluxo de caixa →
          </Button>
        </div>
      )}
    </div>
  );
}
