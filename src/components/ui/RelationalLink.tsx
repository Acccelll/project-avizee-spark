import { useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRelationalNavigation, type EntityType, MAX_DRAWER_DEPTH } from "@/contexts/RelationalNavigationContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface RelationalLinkProps {
  /** Label displayed before the value */
  label?: string;
  /** The display text (e.g. client name, NF number) */
  children: React.ReactNode;
  /** Route to navigate to */
  to?: string;
  /** The entity type to open in a drawer */
  type?: EntityType;
  /** The specific ID of the entity */
  id?: string;
  /** If provided, calls this instead of navigating */
  onClick?: () => void;
  className?: string;
  mono?: boolean;
}

/**
 * Clickable relational link that navigates to a related entity.
 * Use inside ViewDrawer / ViewDrawerV2 to make FK references interactive.
 */
export function RelationalLink({ label, children, to, type, id, onClick, className, mono }: RelationalLinkProps) {
  const navigate = useNavigate();
  const { pushView, canPush } = useRelationalNavigation();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (onClick) {
      onClick();
    } else if (type && id) {
      pushView(type, id);
    } else if (to) {
      navigate(to);
    }
  };

  const isClickable = !!to || !!onClick || (!!type && !!id);

  if (!isClickable) {
    return <span className={cn(mono && "font-mono", className)}>{children}</span>;
  }

  const button = (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 hover:underline underline-offset-2 transition-colors font-medium",
        mono && "font-mono",
        className,
      )}
    >
      {children}
      <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
    </button>
  );

  // When pushing would trigger the jump mechanism, warn the user via tooltip.
  const showDepthWarning = !!(type && id) && !canPush;
  if (showDepthWarning) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-center">
          Limite de {MAX_DRAWER_DEPTH} drawers atingido. Você verá uma confirmação antes de fechar o drawer mais antigo e abrir este novo.
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
