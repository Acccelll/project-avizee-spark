/**
 * @deprecated Compatibility shim — use `SummaryCard` instead. Kept so that
 * existing cadastro pages keep working while migration is incremental.
 * This wrapper now delegates to `SummaryCard` so visual output is unified
 * across all listing screens.
 */
import { LucideIcon } from "lucide-react";
import { SummaryCard, type SummaryCardProps } from "@/components/SummaryCard";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  /** Legacy prop — ignored. SummaryCard derives icon color from `variant`. */
  iconColor?: string;
  onClick?: () => void;
  className?: string;
  /** Optional pass-through to the underlying SummaryCard. */
  variant?: SummaryCardProps["variant"];
  subtitle?: string;
}

export function StatCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon,
  onClick,
  className,
  variant = "default",
  subtitle,
}: StatCardProps) {
  return (
    <SummaryCard
      title={title}
      value={value}
      subtitle={subtitle}
      variation={change}
      variationType={changeType}
      icon={icon}
      onClick={onClick}
      className={className}
      variant={variant}
    />
  );
}
