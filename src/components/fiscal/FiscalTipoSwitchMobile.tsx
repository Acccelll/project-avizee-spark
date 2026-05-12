import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Segmented control mobile para alternar entre Notas de Entrada e Saída
 * preservando demais filtros do `searchParams`. Renderizar somente quando
 * `tipoParam` está definido e em viewports mobile.
 */
interface FiscalTipoSwitchMobileProps {
  current: "entrada" | "saida";
}

export function FiscalTipoSwitchMobile({ current }: FiscalTipoSwitchMobileProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const go = (tipo: "entrada" | "saida") => {
    if (tipo === current) return;
    const params = new URLSearchParams(searchParams);
    params.set("tipo", tipo);
    navigate(`/fiscal?${params.toString()}`);
  };

  const Item = ({ value, label, Icon }: { value: "entrada" | "saida"; label: string; Icon: typeof ArrowDownLeft }) => {
    const active = value === current;
    return (
      <button
        type="button"
        onClick={() => go(value)}
        aria-pressed={active}
        className={cn(
          "flex-1 min-h-11 flex items-center justify-center gap-2 rounded-md text-sm font-medium transition",
          active
            ? "bg-background text-primary shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </button>
    );
  };

  return (
    <div
      role="tablist"
      aria-label="Alternar entre Notas de Entrada e Saída"
      className="md:hidden mb-3 flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1"
    >
      <Item value="entrada" label="Entrada" Icon={ArrowDownLeft} />
      <Item value="saida" label="Saída" Icon={ArrowUpRight} />
    </div>
  );
}