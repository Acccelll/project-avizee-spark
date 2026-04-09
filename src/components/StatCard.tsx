import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  iconColor?: string;
  onClick?: () => void;
  className?: string;
}

export function StatCard({ title, value, change, changeType = "neutral", icon: Icon, iconColor, onClick, className }: StatCardProps) {
  const changeColors = {
    positive: "text-success",
    negative: "text-destructive",
    neutral: "text-muted-foreground",
  };

  return (
    <div
      className={cn(
        "stat-card",
        onClick && "cursor-pointer hover:border-primary/30 active:scale-[0.98]",
        className
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground font-medium tracking-wide truncate">{title}</p>
          <p className="text-2xl font-bold mt-1 tracking-tight">{value}</p>
          {change && (
            <p className={`text-xs mt-1 font-medium ${changeColors[changeType]}`}>
              {change}
            </p>
          )}
        </div>
        <div className={cn("p-3 rounded-lg", iconColor ? "" : "bg-accent")}>
          <Icon className={cn("w-5 h-5", iconColor || "text-primary")} />
        </div>
      </div>
    </div>
  );
}
