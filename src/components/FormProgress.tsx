import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2 } from "lucide-react";

export interface FormTab {
  key: string;
  label: string;
  /** Number of fields in this tab */
  total: number;
  /** Number of fields that have been filled */
  filled: number;
}

interface FormProgressProps {
  tabs: FormTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  className?: string;
}

function tabCompletion(tab: FormTab): number {
  if (tab.total === 0) return 100;
  return Math.round((tab.filled / tab.total) * 100);
}

export function FormProgress({ tabs, activeTab, onTabChange, className }: FormProgressProps) {
  const overallFilled = tabs.reduce((acc, t) => acc + t.filled, 0);
  const overallTotal = tabs.reduce((acc, t) => acc + t.total, 0);
  const overallPct = overallTotal === 0 ? 100 : Math.round((overallFilled / overallTotal) * 100);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Progress value={overallPct} className="h-1.5 flex-1" />
        <span className="tabular-nums font-mono w-10 text-right">{overallPct}%</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {tabs.map((tab) => {
          const pct = tabCompletion(tab);
          const isComplete = pct === 100;
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                "border",
                isActive
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {isComplete ? (
                <CheckCircle2 className="h-3 w-3 shrink-0 text-success" />
              ) : (
                <span
                  className={cn(
                    "h-3 w-3 shrink-0 rounded-full border-2",
                    pct > 0 ? "border-primary" : "border-muted-foreground/40",
                  )}
                  style={pct > 0 && pct < 100 ? { background: `conic-gradient(hsl(var(--primary)) ${pct * 3.6}deg, transparent 0)` } : undefined}
                />
              )}
              {tab.label}
              {!isComplete && (
                <span className="tabular-nums opacity-60">{pct}%</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
