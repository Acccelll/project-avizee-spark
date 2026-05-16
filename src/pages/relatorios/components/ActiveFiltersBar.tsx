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
import { useEffect, useRef, useState } from "react";

export interface ActiveFilterChip {
  id: string;
  label: string;
  /** Texto exibido após o label (ex: "5 selecionados", "Em aberto"). */
  value: string;
  /** Callback de remoção. Se ausente, o chip não mostra o X. */
  onRemove?: () => void;
  tone?: 'default' | 'relevant';
}

export interface ActiveFiltersBarProps {
  chips: ActiveFilterChip[];
  recordCount?: number;
  onClearAll?: () => void;
}

export function ActiveFiltersBar({ chips, recordCount, onClearAll }: ActiveFiltersBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setHasOverflow(el.scrollWidth > el.clientWidth + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [chips, recordCount]);

  if (!chips.length && recordCount == null) return null;

  return (
    <div className="relative border-b bg-muted/30 text-xs">
      <div ref={scrollRef} className="flex items-center gap-2 px-4 py-2.5 overflow-x-auto md:flex-wrap scrollbar-thin">
        {chips.length > 0 && (
        <>
          <Filter className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <span className="text-muted-foreground font-medium flex-shrink-0">Filtros:</span>
          {chips.map((chip) => (
            <Badge
              key={chip.id}
              variant={chip.tone === 'relevant' ? 'default' : 'secondary'}
              className="gap-1 font-normal pr-0.5 py-0.5 flex-shrink-0"
            >
              <span className="text-muted-foreground">{chip.label}:</span>
              <span className="text-foreground font-medium">{chip.value}</span>
              {chip.onRemove && (
                <button
                  type="button"
                  onClick={chip.onRemove}
                  className="ml-0.5 inline-flex items-center justify-center rounded-sm hover:bg-muted-foreground/20 transition-colors min-h-6 min-w-6"
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
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground flex-shrink-0"
            >
              Limpar tudo
            </Button>
          )}
        </>
        )}
        {recordCount != null && (
        <span className="ml-auto text-muted-foreground tabular-nums flex-shrink-0">
          <span className="font-semibold text-foreground">{recordCount}</span>{" "}
          {recordCount === 1 ? "registro" : "registros"}
        </span>
        )}
      </div>
      {hasOverflow && (
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-muted/80 to-transparent md:hidden"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
