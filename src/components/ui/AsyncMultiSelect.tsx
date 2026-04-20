/**
 * AsyncMultiSelect — multi-select with server-side debounced search.
 *
 * Replaces MultiSelect for large reference lists (clientes, fornecedores).
 * The parent provides:
 *   - `loadOptions(query)` → fetches matching options from the backend
 *   - `loadSelectedLabels(ids)` → resolves labels for already-selected IDs
 *
 * Local cache: search results are kept in a useState map keyed by query, so
 * re-opening the popover with the same query is instant. The selected-IDs
 * resolver is called once per id-set change to surface human labels in chips.
 */

import * as React from 'react';
import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

export interface AsyncOption {
  label: string;
  value: string;
}

export interface AsyncMultiSelectProps {
  selected: string[];
  onChange: (selected: string[]) => void;
  loadOptions: (query: string) => Promise<AsyncOption[]>;
  loadSelectedLabels?: (ids: string[]) => Promise<AsyncOption[]>;
  placeholder?: string;
  emptyText?: string;
  minChars?: number;
  className?: string;
}

export function AsyncMultiSelect({
  selected,
  onChange,
  loadOptions,
  loadSelectedLabels,
  placeholder = 'Buscar...',
  emptyText = 'Digite para buscar.',
  minChars = 2,
  className,
}: AsyncMultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const debounced = useDebounce(query, 300);
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<AsyncOption[]>([]);
  const [labelMap, setLabelMap] = React.useState<Record<string, string>>({});

  // Resolve labels for pre-selected ids when they change.
  React.useEffect(() => {
    if (!loadSelectedLabels || selected.length === 0) return;
    const missing = selected.filter((id) => !labelMap[id]);
    if (!missing.length) return;
    let cancelled = false;
    loadSelectedLabels(missing)
      .then((opts) => {
        if (cancelled) return;
        setLabelMap((prev) => {
          const next = { ...prev };
          for (const o of opts) next[o.value] = o.label;
          return next;
        });
      })
      .catch(() => {
        /* swallow — chip will show id as fallback */
      });
    return () => {
      cancelled = true;
    };
  }, [selected, loadSelectedLabels, labelMap]);

  // Run search when debounced query changes (only while popover is open).
  React.useEffect(() => {
    if (!open) return;
    if (debounced.length < minChars) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadOptions(debounced)
      .then((opts) => {
        if (cancelled) return;
        setResults(opts);
        setLabelMap((prev) => {
          const next = { ...prev };
          for (const o of opts) next[o.value] = o.label;
          return next;
        });
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, open, minChars, loadOptions]);

  const handleUnselect = (id: string) => {
    onChange(selected.filter((i) => i !== id));
  };

  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((i) => i !== id)
        : [...selected, id],
    );
  };

  const labelFor = (id: string) => labelMap[id] ?? id;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between h-auto min-h-10 py-1 px-3',
            className,
          )}
        >
          <div className="flex flex-wrap gap-1">
            {selected.length > 0 ? (
              selected.map((id) => (
                <Badge
                  variant="secondary"
                  key={id}
                  className="mr-1 mb-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUnselect(id);
                  }}
                >
                  <span className="max-w-[160px] truncate">{labelFor(id)}</span>
                  <button
                    type="button"
                    className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleUnselect(id);
                    }}
                    aria-label={`Remover ${labelFor(id)}`}
                  >
                    <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </button>
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full min-w-[240px] p-0" align="start">
        <Command shouldFilter={false} className="w-full">
          <CommandInput
            placeholder={placeholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {loading && (
              <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Buscando...
              </div>
            )}
            {!loading && query.length < minChars && (
              <CommandEmpty>{emptyText}</CommandEmpty>
            )}
            {!loading && query.length >= minChars && results.length === 0 && (
              <CommandEmpty>Nenhum resultado.</CommandEmpty>
            )}
            {!loading && results.length > 0 && (
              <CommandGroup className="max-h-64 overflow-auto">
                {results.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    onSelect={() => toggle(opt.value)}
                  >
                    <div
                      className={cn(
                        'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                        selected.includes(opt.value)
                          ? 'bg-primary text-primary-foreground'
                          : 'opacity-50 [&_svg]:invisible',
                      )}
                    >
                      <Check className="h-4 w-4" />
                    </div>
                    <span className="truncate">{opt.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}