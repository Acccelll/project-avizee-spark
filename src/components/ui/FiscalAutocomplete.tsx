import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FiscalAutocompleteProps {
  data: { code: string; desc: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function FiscalAutocomplete({ data, value, onChange, placeholder, className }: FiscalAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = (search || value).toLowerCase();
    if (!q) return data.slice(0, 10);
    return data.filter((d) => d.code.includes(q) || d.desc.toLowerCase().includes(q)).slice(0, 10);
  }, [data, search, value]);

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder={placeholder}
        className={cn("font-mono text-sm", className)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border bg-popover shadow-md">
          {filtered.map((item) => (
            <button
              key={item.code}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(item.code);
                setSearch("");
                setOpen(false);
              }}
            >
              <span className="font-mono font-semibold text-primary">{item.code}</span>
              <span className="text-muted-foreground truncate text-xs">{item.desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
