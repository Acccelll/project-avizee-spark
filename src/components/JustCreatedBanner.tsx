import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface JustCreatedBannerProps {
  /** Texto principal. Ex.: "Orçamento PV-0123 criado." */
  message: string;
  /** Texto do CTA opcional. Ex.: "Adicionar itens" */
  ctaLabel?: string;
  /** Callback do CTA. */
  onCta?: () => void;
  /** Auto-dismiss em ms (default 12000). */
  autoDismissMs?: number;
  /** Query param que ativa o banner. Default: "created". */
  queryKey?: string;
  className?: string;
}

/**
 * Banner verde discreto exibido após criação de um documento.
 * Ativa quando a URL contém `?created=1` e desmonta no primeiro click ou após timeout.
 */
export function JustCreatedBanner({
  message,
  ctaLabel,
  onCta,
  autoDismissMs = 12000,
  queryKey = "created",
  className,
}: JustCreatedBannerProps) {
  const [params, setParams] = useSearchParams();
  const active = params.get(queryKey) === "1";
  const [visible, setVisible] = useState(active);

  useEffect(() => {
    setVisible(active);
  }, [active]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => dismiss(), autoDismissMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dismiss recria a cada render por usar setSearchParams; fechar via closure evita loop de reset do timer
  }, [visible, autoDismissMs]);

  const dismiss = () => {
    setVisible(false);
    const next = new URLSearchParams(params);
    next.delete(queryKey);
    setParams(next, { replace: true });
  };

  if (!visible) return null;

  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-3 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm",
        "animate-in fade-in slide-in-from-top-1",
        className,
      )}
    >
      <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
      <span className="flex-1 text-foreground">{message}</span>
      {ctaLabel && onCta && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 border-success/40 bg-background"
          onClick={() => {
            onCta();
            dismiss();
          }}
        >
          {ctaLabel}
        </Button>
      )}
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 shrink-0"
        onClick={dismiss}
        aria-label="Fechar"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
