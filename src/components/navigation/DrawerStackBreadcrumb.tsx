import { ChevronRight } from "lucide-react";
import { useRelationalNavigation, type EntityType } from "@/contexts/RelationalNavigationContext";
import { useDrawerSlots } from "@/contexts/RelationalDrawerSlotsContext";
import { cn } from "@/lib/utils";

const TYPE_SHORT_LABELS: Record<EntityType, string> = {
  produto: "Produto",
  cliente: "Cliente",
  fornecedor: "Fornecedor",
  orcamento: "Cotação",
  pedido_compra: "PC",
  nota_fiscal: "NF",
  remessa: "Remessa",
  ordem_venda: "Pedido",
};

/**
 * Renders a clickable segment per stack item using its published breadcrumb
 * (or a fallback label) so consumers don't need to fetch labels themselves.
 */
function Segment({
  index,
  type,
  id,
  active,
  onClick,
}: {
  index: number;
  type: EntityType;
  id: string;
  active: boolean;
  onClick: () => void;
}) {
  const slots = useDrawerSlots(`${type}:${id}`);
  // Slots breadcrumb often comes as "Pedido · OV-123"; if present use that.
  const label = slots?.breadcrumb || `${TYPE_SHORT_LABELS[type]} ${id.slice(0, 6)}`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={active}
      className={cn(
        "max-w-[160px] truncate rounded px-1 py-0.5 text-[11px] transition-colors",
        active
          ? "font-semibold text-foreground cursor-default"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
      )}
      title={typeof label === "string" ? label : undefined}
    >
      {label}
    </button>
  );
}

interface DrawerStackBreadcrumbProps {
  className?: string;
}

/**
 * Breadcrumb encadeado que reflete o stack atual do RelationalNavigation.
 * Cada segmento é clicável: ao clicar em um nível anterior, fecha-se todos
 * os drawers acima dele (sem mexer nos abaixo).
 */
export function DrawerStackBreadcrumb({ className }: DrawerStackBreadcrumbProps) {
  const { stack, popView } = useRelationalNavigation();

  if (stack.length <= 1) return null;

  const goToLevel = (targetIndex: number) => {
    // Pop até chegar no índice alvo
    const stepsToPop = stack.length - 1 - targetIndex;
    for (let i = 0; i < stepsToPop; i++) popView();
  };

  return (
    <nav
      className={cn("flex items-center gap-0.5 flex-wrap", className)}
      aria-label="Trilha de drawers abertos"
    >
      {stack.map((view, idx) => (
        <span key={`${view.type}-${view.id}-${idx}`} className="flex items-center gap-0.5">
          {idx > 0 && (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />
          )}
          <Segment
            index={idx}
            type={view.type}
            id={view.id}
            active={idx === stack.length - 1}
            onClick={() => goToLevel(idx)}
          />
        </span>
      ))}
    </nav>
  );
}
