import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, ArrowRight, DollarSign, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FluxoCaixaChart } from './FluxoCaixaChart';
import { formatCurrency, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

interface FinanceiroBlockProps {
  totalReceber: number;
  totalPagar: number;
  contasVencidas: number;
  saldoProjetado: number;
  recebimentosHoje: number;
  pagamentosHoje: number;
}

interface IndicadorProps {
  label: string;
  value: string;
  subtext?: string;
  variant?: 'default' | 'positive' | 'negative' | 'warning';
}

function Indicador({ label, value, subtext, variant = 'default' }: IndicadorProps) {
  const valueColor = {
    default: 'text-foreground',
    positive: 'text-success',
    negative: 'text-destructive',
    warning: 'text-warning',
  }[variant];

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('text-sm font-bold mono', valueColor)}>{value}</span>
      {subtext && <span className="text-[11px] text-muted-foreground">{subtext}</span>}
    </div>
  );
}

export function FinanceiroBlock({
  totalReceber,
  totalPagar,
  contasVencidas,
  saldoProjetado,
  recebimentosHoje,
  pagamentosHoje,
}: FinanceiroBlockProps) {
  const navigate = useNavigate();
  const saldoPositivo = saldoProjetado >= 0;

  return (
    <div className="bg-card rounded-xl border flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/60">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          Financeiro
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-primary hover:text-primary"
          onClick={() => navigate('/financeiro')}
        >
          Abrir módulo <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Indicadores rápidos */}
      <div className="grid grid-cols-2 gap-px border-b border-border/60 md:grid-cols-4">
        <div className="px-4 py-3">
          <Indicador
            label="A receber"
            value={formatCurrency(totalReceber)}
            subtext="títulos em aberto"
            variant="positive"
          />
        </div>
        <div className="px-4 py-3 border-l border-border/60">
          <Indicador
            label="A pagar"
            value={formatCurrency(totalPagar)}
            subtext="títulos em aberto"
            variant={totalPagar > totalReceber ? 'negative' : 'default'}
          />
        </div>
        <div className="px-4 py-3 border-l border-border/60">
          <Indicador
            label="Saldo projetado"
            value={formatCurrency(saldoProjetado)}
            subtext={saldoPositivo ? 'saldo positivo' : 'saldo negativo'}
            variant={saldoPositivo ? 'positive' : 'negative'}
          />
        </div>
        <div className="px-4 py-3 border-l border-border/60">
          {contasVencidas > 0 ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Vencidos</span>
              <span className="text-sm font-bold mono text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                {formatNumber(contasVencidas)}
              </span>
              <span className="text-[11px] text-muted-foreground">títulos em atraso</span>
            </div>
          ) : (
            <Indicador label="Vencidos" value="0" subtext="sem atrasos" variant="positive" />
          )}
        </div>
      </div>

      {/* Gráfico */}
      <div className="flex-1 p-4">
        <FluxoCaixaChart />
      </div>

      {/* Vencimentos de hoje */}
      {(recebimentosHoje > 0 || pagamentosHoje > 0) && (
        <div className="flex items-center gap-4 border-t border-border/60 px-5 py-2.5">
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
