import { Clock, FileText, DollarSign, CheckCircle } from "lucide-react";
import { SummaryCard } from "@/components/SummaryCard";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format";

export interface FiscalKpis {
  total: number;
  pendentes: number;
  confirmadas: number;
  valorTotal: number;
}

interface FiscalKpisStripProps {
  kpis: FiscalKpis;
  isMobile: boolean;
  /** statusFilters.includes("pendente") — controla aria-pressed e copy do banner mobile. */
  pendenteFiltroAtivo: boolean;
  /** Alterna o filtro de status para `["pendente"]` ↔ `[]`. */
  onTogglePendenteFilter: () => void;
}

/**
 * Strip de KPIs do módulo Fiscal — extraído de `Fiscal.tsx` (linhas 1463–1521).
 * Puramente apresentacional: todo o estado vive no pai (`useFiscalKpis`, `useFiscalFilters`).
 */
export function FiscalKpisStrip({
  kpis,
  isMobile,
  pendenteFiltroAtivo,
  onTogglePendenteFilter,
}: FiscalKpisStripProps) {
  return (
    <>
      {/* Banner mobile tappable: filtra para Pendentes em 1 toque */}
      {isMobile && kpis.pendentes > 0 && (
        <button
          type="button"
          onClick={onTogglePendenteFilter}
          aria-pressed={pendenteFiltroAtivo}
          className="md:hidden w-full mb-3 min-h-11 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2.5 flex items-center justify-between gap-3 active:bg-warning/20 transition-colors"
          aria-label={
            pendenteFiltroAtivo
              ? "Limpar filtro de notas pendentes"
              : `Filtrar ${kpis.pendentes} notas pendentes`
          }
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Clock className="h-4 w-4 shrink-0 text-warning" />
            <span className="text-sm font-medium text-warning-foreground truncate">
              {kpis.pendentes} {kpis.pendentes === 1 ? "nota pendente" : "notas pendentes"}
            </span>
          </div>
          <span className="text-xs text-warning shrink-0">
            {pendenteFiltroAtivo ? "Limpar ×" : "Filtrar →"}
          </span>
        </button>
      )}
      <div className="grid grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 mb-6">
        {/* Total de NFs oculto em mobile (redundante com count da lista) */}
        <SummaryCard
          className="hidden md:block"
          title="Total de NFs"
          value={String(kpis.total)}
          icon={FileText}
          variationType="neutral"
          variation="registros"
        />
        <SummaryCard
          title="Valor Total"
          shortTitle="Valor"
          value={isMobile ? formatCurrencyCompact(kpis.valorTotal) : formatCurrency(kpis.valorTotal)}
          icon={DollarSign}
          variationType="neutral"
          variation="acumulado"
          density={isMobile ? "compact" : "default"}
        />
        <SummaryCard
          title="Pendentes"
          value={String(kpis.pendentes)}
          icon={Clock}
          variant={kpis.pendentes > 0 ? "warning" : "default"}
          variationType={kpis.pendentes > 0 ? "negative" : "neutral"}
          variation="aguardando"
          density={isMobile ? "compact" : "default"}
        />
        <SummaryCard
          title="Confirmadas"
          value={String(kpis.confirmadas)}
          icon={CheckCircle}
          variant="success"
          variationType="positive"
          variation="processadas"
          density={isMobile ? "compact" : "default"}
        />
      </div>
    </>
  );
}