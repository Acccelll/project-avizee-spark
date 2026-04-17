import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Input } from "@/components/ui/input";
import { Search, PlusCircle } from "lucide-react";

export interface AutocompleteOption {
  id: string;
  label: string;
  sublabel?: string;
  searchTerms?: string[];
  imageUrl?: string | null;
  rightMeta?: string;
  /** Optional third line rendered below sublabel */
  metaLine?: string;
}

interface Props {
  options: AutocompleteOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
  onCreateNew?: () => void;
  createNewLabel?: string;
  /** Minimum width of the dropdown. Defaults to 'min-w-[360px]' */
  dropdownMinWidth?: string;
}

export function AutocompleteSearch({
  options,
  value,
  onChange,
  placeholder = "Buscar...",
  className,
  onCreateNew,
  createNewLabel = "Cadastrar novo",
  dropdownMinWidth = "min-w-[360px]",
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

  // Virtualize when there are more than 100 items
  const shouldVirtualize = filtered.length > 100;
  const ITEM_HEIGHT = 60;
  const MAX_VISIBLE = 5;

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 5,
    enabled: shouldVirtualize,
  });

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
    if (highlightIdx >= 0 && listRef.current && !shouldVirtualize) {
      const el = listRef.current.children[highlightIdx] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIdx, shouldVirtualize]);

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

  const renderItem = (o: AutocompleteOption, idx: number, style?: React.CSSProperties) => (
    <button
      key={o.id}
      type="button"
      style={style}
      className={`w-full text-left px-3 py-2.5 text-sm transition-colors flex items-start justify-between gap-2 ${
        idx === highlightIdx ? "bg-accent" : "hover:bg-accent"
      } ${!style && idx > 0 ? "border-t border-border/40" : ""} ${style ? "border-t border-border/40" : ""}`}
      onClick={() => selectOption(o.id)}
      onMouseEnter={() => setHighlightIdx(idx)}
    >
      <span className="flex items-start gap-2 min-w-0 flex-1">
        {o.imageUrl ? <img src={o.imageUrl} alt={o.label} className="h-8 w-8 rounded object-cover mt-0.5 shrink-0" /> : null}
        <span className="min-w-0 flex-1">
          <span className="font-medium block truncate leading-snug text-foreground">{o.label}</span>
          {o.sublabel && (
            <span className="text-xs text-muted-foreground block truncate leading-snug mt-0.5">{o.sublabel}</span>
          )}
          {o.metaLine && (
            <span className="text-[11px] text-muted-foreground/70 block truncate leading-snug mt-0.5">{o.metaLine}</span>
          )}
        </span>
      </span>
      {o.rightMeta && (
        <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0 mt-0.5 font-mono">{o.rightMeta}</span>
      )}
    </button>
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
        <div
          ref={listRef}
          className={`absolute z-50 top-full mt-1 w-full ${dropdownMinWidth} bg-popover border rounded-lg shadow-lg overflow-y-auto`}
          style={{
            maxWidth: "min(520px, 100vw - 24px)",
            maxHeight: shouldVirtualize ? `${ITEM_HEIGHT * MAX_VISIBLE}px` : "18rem",
          }}
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              Nenhum resultado encontrado
              {onCreateNew && (
                <button type="button" onClick={onCreateNew} className="mt-2 flex items-center gap-1 text-primary text-xs font-medium">
                  <PlusCircle className="h-3.5 w-3.5" />
                  {createNewLabel}
                </button>
              )}
            </div>
          ) : shouldVirtualize ? (
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
              {virtualizer.getVirtualItems().map((vRow) => {
                const o = filtered[vRow.index];
                return renderItem(o, vRow.index, {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${vRow.start}px)`,
                });
              })}
            </div>
          ) : (
            filtered.map((o, idx) => renderItem(o, idx))
          )}
        </div>
      )}
    </div>
  );
}
