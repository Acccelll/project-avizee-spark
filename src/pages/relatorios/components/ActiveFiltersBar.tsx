/**
 * ActiveFiltersBar — linha compacta com chips removíveis dos filtros aplicados.
 *
 * Render acima do resultado para dar visibilidade do que está filtrando os dados.
 * Cada chip tem um botão X para remover o filtro individualmente, e um botão
 * "Limpar tudo" zera todos os filtros (mantendo o tipo de relatório).
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Filter } from "lucide-react";

export interface ActiveFilterChip {
  id: string;
  label: string;
  /** Texto exibido após o label (ex: "5 selecionados", "Em aberto"). */
  value: string;
  /** Callback de remoção. Se ausente, o chip não mostra o X. */
  onRemove?: () => void;
}

export interface ActiveFiltersBarProps {
  chips: ActiveFilterChip[];
  recordCount?: number;
  onClearAll?: () => void;
}

export function ActiveFiltersBar({ chips, recordCount, onClearAll }: ActiveFiltersBarProps) {
  if (!chips.length && recordCount == null) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap px-4 py-2.5 border-b bg-muted/30 text-xs">
      {chips.length > 0 && (
        <>
          <Filter className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <span className="text-muted-foreground font-medium">Filtros:</span>
          {chips.map((chip) => (
            <Badge
              key={chip.id}
              variant="secondary"
              className="gap-1 font-normal pr-1 py-0.5"
            >
              <span className="text-muted-foreground">{chip.label}:</span>
              <span className="text-foreground font-medium">{chip.value}</span>
              {chip.onRemove && (
                <button
                  type="button"
                  onClick={chip.onRemove}
                  className="ml-0.5 rounded-sm hover:bg-muted-foreground/20 p-0.5 transition-colors"
                  aria-label={`Remover filtro ${chip.label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
          {onClearAll && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Limpar tudo
            </Button>
          )}
        </>
      )}
      {recordCount != null && (
        <span className="ml-auto text-muted-foreground tabular-nums">
          <span className="font-semibold text-foreground">{recordCount}</span>{" "}
          {recordCount === 1 ? "registro" : "registros"}
        </span>
      )}
    </div>
  );
}
