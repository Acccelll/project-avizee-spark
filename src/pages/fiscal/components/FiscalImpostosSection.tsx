import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELDS = [
  { label: "Frete", key: "frete_valor" },
  { label: "ICMS", key: "icms_valor" },
  { label: "IPI", key: "ipi_valor" },
  { label: "PIS", key: "pis_valor" },
  { label: "COFINS", key: "cofins_valor" },
  { label: "ICMS-ST", key: "icms_st_valor" },
  { label: "Desconto", key: "desconto_valor" },
  { label: "Outras Despesas", key: "outras_despesas" },
] as const;

const FIELDS_BY_MODELO: Record<string, readonly string[]> = {
  "55": ["frete_valor", "icms_valor", "ipi_valor", "pis_valor", "cofins_valor", "icms_st_valor", "desconto_valor", "outras_despesas"],
  "65": ["icms_valor", "pis_valor", "cofins_valor", "desconto_valor", "outras_despesas"],
  "57": ["frete_valor", "desconto_valor", "outras_despesas"],
  "67": ["frete_valor", "desconto_valor", "outras_despesas"],
  nfse: ["pis_valor", "cofins_valor", "desconto_valor", "outras_despesas"],
  outro: ["frete_valor", "icms_valor", "ipi_valor", "pis_valor", "cofins_valor", "icms_st_valor", "desconto_valor", "outras_despesas"],
};

interface FiscalImpostosSectionProps {
  values: Record<string, string | number | boolean>;
  onChange: (key: string, value: number) => void;
  /** Modelo do documento fiscal (55, 65, 57, 67, nfse, outro). Filtra os campos exibidos. */
  modelo?: string;
}

/**
 * Bloco de Frete, Impostos e Despesas do form Fiscal.
 * Colapsável no mobile, sempre aberto no desktop.
 * Extraído de Fiscal.tsx (Fase 6) — preserva markup/estilos.
 */
export function FiscalImpostosSection({ values, onChange, modelo = "55" }: FiscalImpostosSectionProps) {
  const activeKeys = FIELDS_BY_MODELO[modelo] ?? FIELDS_BY_MODELO["55"];
  const visibleFields = FIELDS.filter((f) => activeKeys.includes(f.key));
  return (
    <Collapsible defaultOpen={false} className="space-y-3 md:[&]:!block">
      <CollapsibleTrigger
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-left min-h-11 md:hidden"
      >
        <span className="text-sm font-semibold">Frete, Impostos e Despesas</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <Label className="hidden md:block text-sm font-semibold">Frete, Impostos e Despesas</Label>
      <CollapsibleContent
        forceMount
        className="md:!block data-[state=closed]:hidden md:data-[state=closed]:!block"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {visibleFields.map(({ label, key }) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={String(values[key] ?? "")}
                onChange={(e) => onChange(key, Number(e.target.value))}
                className="h-11 md:h-8 text-sm md:text-xs"
              />
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}