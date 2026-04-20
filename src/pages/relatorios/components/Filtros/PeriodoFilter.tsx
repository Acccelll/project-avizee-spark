/**
 * PeriodoFilter — controlled date-range filter with quick-period shortcuts.
 *
 * Quick-period buttons mostram estado ativo (variant="default") quando o
 * intervalo atual bate com o preset. As datas customizadas ficam colapsadas
 * por padrão sob o disclosure "Personalizado" para reduzir densidade.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown } from "lucide-react";

export interface PeriodoFilterValue {
  dataInicio: string;
  dataFim: string;
}

export interface PeriodoFilterProps {
  dataInicio: string;
  dataFim: string;
  /** Optional human label of the temporal axis applied (e.g. "vencimento"). */
  axisLabel?: string;
  highlighted?: boolean;
  onChange: (value: PeriodoFilterValue) => void;
}

type QuickPeriod = "hoje" | "7d" | "30d" | "mes";

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

function rangeOf(period: QuickPeriod): PeriodoFilterValue {
  const now = new Date();
  const end = fmt(now);
  if (period === "hoje") return { dataInicio: end, dataFim: end };
  if (period === "7d") {
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    return { dataInicio: fmt(start), dataFim: end };
  }
  if (period === "30d") {
    const start = new Date(now);
    start.setDate(now.getDate() - 30);
    return { dataInicio: fmt(start), dataFim: end };
  }
  // "mes"
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { dataInicio: fmt(start), dataFim: end };
}

/** Detecta qual preset corresponde ao intervalo atual (ou null). */
function detectActive(dataInicio: string, dataFim: string): QuickPeriod | null {
  if (!dataInicio || !dataFim) return null;
  const presets: QuickPeriod[] = ["hoje", "7d", "30d", "mes"];
  for (const p of presets) {
    const r = rangeOf(p);
    if (r.dataInicio === dataInicio && r.dataFim === dataFim) return p;
  }
  return null;
}

export function PeriodoFilter({ dataInicio, dataFim, onChange, axisLabel, highlighted }: PeriodoFilterProps) {
  const today = fmt(new Date());
  const active = detectActive(dataInicio, dataFim);
  const hasCustom = !!(dataInicio || dataFim);
  const [showCustom, setShowCustom] = useState<boolean>(hasCustom && !active);

  // Mantém o disclosure aberto se o usuário escolheu intervalo manual.
  useEffect(() => {
    if (hasCustom && !active) setShowCustom(true);
  }, [hasCustom, active]);

  const apply = (period: QuickPeriod) => {
    setShowCustom(false);
    onChange(rangeOf(period));
  };

  return (
    <div className={`space-y-2 ${highlighted ? 'rounded-md bg-primary/5 ring-1 ring-primary/20 px-2 py-2' : ''}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Label className="text-xs text-muted-foreground mr-1">
          Período{axisLabel ? <span className="ml-1 text-muted-foreground/80">por {axisLabel}</span> : null}:
        </Label>
        <Button
          size="sm"
          variant={active === "hoje" ? "default" : "outline"}
          onClick={() => apply("hoje")}
          className="h-8"
        >
          Hoje
        </Button>
        <Button
          size="sm"
          variant={active === "7d" ? "default" : "outline"}
          onClick={() => apply("7d")}
          className="h-8"
        >
          7 dias
        </Button>
        <Button
          size="sm"
          variant={active === "30d" ? "default" : "outline"}
          onClick={() => apply("30d")}
          className="h-8"
        >
          30 dias
        </Button>
        <Button
          size="sm"
          variant={active === "mes" ? "default" : "outline"}
          onClick={() => apply("mes")}
          className="h-8"
        >
          Mês atual
        </Button>
        <Button
          size="sm"
          variant={showCustom || (!active && hasCustom) ? "default" : "outline"}
          onClick={() => setShowCustom((v) => !v)}
          className="h-8 gap-1"
          aria-expanded={showCustom}
        >
          Personalizado
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${showCustom ? "rotate-180" : ""}`}
          />
        </Button>
      </div>

      {showCustom && (
        <div className="flex flex-wrap items-end gap-3 pl-1">
          <div className="space-y-1">
            <Label className="text-xs">Data inicial</Label>
            <Input
              type="date"
              value={dataInicio}
              max={dataFim || today}
              onChange={(e) => onChange({ dataInicio: e.target.value, dataFim })}
              className="h-9 w-[160px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Data final</Label>
            <Input
              type="date"
              value={dataFim}
              min={dataInicio || undefined}
              max={today}
              onChange={(e) => onChange({ dataInicio, dataFim: e.target.value })}
              className="h-9 w-[160px]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
