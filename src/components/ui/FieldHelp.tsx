import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface FieldHelpProps {
  text: string;
  className?: string;
}

/**
 * Displays a small question-mark icon next to a field label. On hover,
 * shows a tooltip with the `text` explanation. Intended for critical or
 * non-obvious fields (e.g. CFOP, CST, NCM).
 */
export function FieldHelp({ text, className }: FieldHelpProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex items-center cursor-help text-muted-foreground hover:text-foreground transition-colors", className)}>
          <HelpCircle className="h-3.5 w-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
