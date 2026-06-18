import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { STEPS } from "./schema";

export function Stepper({
  current,
  onStepClick,
}: {
  current: number;
  onStepClick: (n: number) => void;
}) {
  return (
    <div>
      <div className="flex w-full overflow-x-auto pb-1">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const done = i < current;
        const active = i === current;
        const isClickable = done;
        return (
          <div key={s.key} className="flex items-center min-w-fit">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
                  done && "bg-success text-success-foreground border-success",
                  active && "bg-primary text-primary-foreground border-primary",
                  !done && !active && "bg-muted text-muted-foreground",
                  isClickable && "cursor-pointer hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-primary/40",
                )}
                onClick={isClickable ? () => onStepClick(i) : undefined}
                role={isClickable ? "button" : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onKeyDown={
                  isClickable
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onStepClick(i);
                        }
                      }
                    : undefined
                }
                aria-label={isClickable ? `Voltar para ${s.label}` : undefined}
                title={isClickable ? `Voltar para ${s.label}` : undefined}
              >
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span
                className={cn(
                  "text-sm hidden sm:inline",
                  active ? "font-semibold" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("mx-3 h-px w-12 sm:w-16", done ? "bg-success" : "bg-border")} />
            )}
          </div>
        );
      })}
      </div>
      <p className="text-sm font-medium text-center text-foreground mt-1 sm:hidden">
        Passo {current + 1}/{STEPS.length} — {STEPS[current].label}
      </p>
    </div>
  );
}