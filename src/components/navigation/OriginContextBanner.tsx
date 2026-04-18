import { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OriginContextBannerProps {
  /** Texto do botão de retorno (ex.: "Voltar ao Pedido de Compra PC-123"). */
  originLabel: ReactNode;
  /** Função executada ao clicar no botão de retorno. */
  onBack: () => void;
  /** Descrição contextual à direita (ex.: "Vinculando NF de entrada deste pedido"). */
  description?: ReactNode;
  className?: string;
}

/**
 * Banner discreto exibido no topo de um módulo destino quando o usuário
 * chegou nele a partir de outro módulo (via query params de origem).
 *
 * Resolve o problema de "chegada sem contexto" — o usuário não fica
 * perdido sobre de onde veio nem como voltar.
 */
export function OriginContextBanner({
  originLabel,
  onBack,
  description,
  className,
}: OriginContextBannerProps) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-col gap-2 rounded-lg border border-info/30 bg-info/5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
      role="status"
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="h-7 -ml-2 gap-1.5 px-2 text-xs font-medium text-info hover:bg-info/10 hover:text-info"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span className="truncate">{originLabel}</span>
      </Button>
      {description && (
        <span className="text-[11px] text-muted-foreground sm:text-right">
          {description}
        </span>
      )}
    </div>
  );
}
