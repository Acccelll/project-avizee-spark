import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Search, PlusCircle } from "lucide-react";

export interface AutocompleteOption {
  id: string;
  label: string;
  sublabel?: string;
  searchTerms?: string[];
  imageUrl?: string | null;
  rightMeta?: string;
}

interface Props {
  options: AutocompleteOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
  onCreateNew?: () => void;
  createNewLabel?: string;
}

export function AutocompleteSearch({
  options,
  value,
  onChange,
  placeholder = "Buscar...",
  className,
  onCreateNew,
  createNewLabel = "Cadastrar novo",
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      if (o.label.toLowerCase().includes(q)) return true;
      if (o.sublabel && o.sublabel.toLowerCase().includes(q)) return true;
      if (o.searchTerms?.some((t) => t.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [options, query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    setHighlightIdx(-1);
  }, [query]);

  useEffect(() => {
    if (highlightIdx >= 0 && listRef.current) {
      const el = listRef.current.children[highlightIdx] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIdx]);

  const selectOption = useCallback(
    (id: string) => {
      onChange(id);
      setOpen(false);
      setQuery("");
      setHighlightIdx(-1);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) return;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightIdx((prev) => Math.min(prev + 1, filtered.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightIdx((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (highlightIdx >= 0 && filtered[highlightIdx]) {
            selectOption(filtered[highlightIdx].id);
          }
          break;
        case "Escape":
          setOpen(false);
          break;
      }
    },
    [open, filtered, highlightIdx, selectOption]
  );

  return (
    <div ref={ref} className={`relative ${className || ""}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={open ? query : selected?.label || ""}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-9"
        />
      </div>
      {open && (
        <div ref={listRef} className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-lg shadow-md max-h-72 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Nenhum resultado
              {onCreateNew && (
                <button type="button" onClick={onCreateNew} className="mt-2 flex items-center gap-1 text-primary text-xs font-medium">
                  <PlusCircle className="h-3.5 w-3.5" />
                  {createNewLabel}
                </button>
              )}
            </div>
          ) : (
            filtered.map((o, idx) => (
              <button
                key={o.id}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between gap-2 ${
                  idx === highlightIdx ? "bg-accent" : "hover:bg-accent"
                }`}
                onClick={() => selectOption(o.id)}
                onMouseEnter={() => setHighlightIdx(idx)}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {o.imageUrl ? <img src={o.imageUrl} alt={o.label} className="h-8 w-8 rounded object-cover" /> : null}
                  <span className="min-w-0">
                    <span className="font-medium block truncate">{o.label}</span>
                    {o.sublabel && <span className="text-xs text-muted-foreground block truncate">{o.sublabel}</span>}
                  </span>
                </span>
                {o.rightMeta && <span className="text-[11px] text-muted-foreground whitespace-nowrap">{o.rightMeta}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
