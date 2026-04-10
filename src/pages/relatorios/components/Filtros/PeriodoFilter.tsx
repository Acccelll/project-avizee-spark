/**
 * PeriodoFilter — controlled date-range filter with quick-period shortcuts.
 *
 * Props:
 *   dataInicio / dataFim   current ISO date strings (YYYY-MM-DD)
 *   onChange               called whenever either bound or a quick period changes
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PeriodoFilterValue {
  dataInicio: string;
  dataFim: string;
}

export interface PeriodoFilterProps {
  dataInicio: string;
  dataFim: string;
  onChange: (value: PeriodoFilterValue) => void;
}

type QuickPeriod = "hoje" | "7d" | "30d" | "mes";

export function PeriodoFilter({ dataInicio, dataFim, onChange }: PeriodoFilterProps) {
  const today = new Date().toISOString().slice(0, 10);

  const applyQuick = (period: QuickPeriod) => {
    const now = new Date();
    const end = now.toISOString().slice(0, 10);

    if (period === "hoje") {
      onChange({ dataInicio: end, dataFim: end });
      return;
    }
    if (period === "7d") {
      const start = new Date(now);
      start.setDate(now.getDate() - 7);
      onChange({ dataInicio: start.toISOString().slice(0, 10), dataFim: end });
      return;
    }
    if (period === "30d") {
      const start = new Date(now);
      start.setDate(now.getDate() - 30);
      onChange({ dataInicio: start.toISOString().slice(0, 10), dataFim: end });
      return;
    }
    // "mes"
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    onChange({ dataInicio: start, dataFim: end });
  };

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Data inicial</Label>
        <Input
          type="date"
          value={dataInicio}
          max={dataFim || today}
          onChange={(e) => onChange({ dataInicio: e.target.value, dataFim })}
          className="h-9 w-[160px]"
        />
      </div>

      <div className="space-y-1.5">
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

      <div className="space-y-1.5">
        <Label className="text-xs">Períodos rápidos</Label>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => applyQuick("hoje")}>
            Hoje
          </Button>
          <Button size="sm" variant="outline" onClick={() => applyQuick("7d")}>
            7 dias
          </Button>
          <Button size="sm" variant="outline" onClick={() => applyQuick("30d")}>
            30 dias
          </Button>
          <Button size="sm" variant="outline" onClick={() => applyQuick("mes")}>
            Mês atual
          </Button>
        </div>
      </div>
    </div>
  );
}
