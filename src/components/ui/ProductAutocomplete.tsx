import { useState, useMemo, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { parseVariacoes, formatVariacoesSuffix } from "@/utils/cadastros";

interface ProductAutocompleteProps {
  products: { id: string; nome: string; sku?: string; codigo_interno?: string; variacoes?: string | string[] | null }[];
  value: string;
  onChange: (productId: string) => void;
  placeholder?: string;
  className?: string;
}

export function ProductAutocomplete({ products, value, onChange, placeholder, className }: ProductAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedProduct = products.find((p) => p.id === value);
  const displayValue = selectedProduct
    ? `${selectedProduct.sku ? `[${selectedProduct.sku}] ` : ""}${selectedProduct.nome}${formatVariacoesSuffix(selectedProduct.variacoes)}`
    : "";

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return products.slice(0, 15);
    return products.filter((p) => {
      if (p.nome.toLowerCase().includes(q)) return true;
      if (p.sku && p.sku.toLowerCase().includes(q)) return true;
      if (p.codigo_interno && p.codigo_interno.toLowerCase().includes(q)) return true;
      const vars = parseVariacoes(p.variacoes);
      return vars.some((v) => v.toLowerCase().includes(q));
    }).slice(0, 15);
  }, [products, search]);

  // Click-outside (substitui setTimeout no onBlur).
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={open ? search : displayValue}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setSearch("");
          setOpen(true);
        }}
        placeholder={placeholder || "Buscar produto..."}
        className={cn("h-9", className)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border bg-popover shadow-md">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              className={cn(
                "w-full text-left px-3 py-1.5 text-sm hover:bg-accent cursor-pointer",
                p.id === value && "bg-accent font-medium"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(p.id);
                setSearch("");
                setOpen(false);
              }}
            >
              {p.sku ? <span className="text-muted-foreground">[{p.sku}] </span> : null}
              {p.nome}
              {formatVariacoesSuffix(p.variacoes) && (
                <span className="text-muted-foreground">{formatVariacoesSuffix(p.variacoes)}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
