import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getFiscalInternalStatus, getFiscalSefazStatus } from "@/lib/fiscalStatus";

interface Props {
  status?: string | null;
  className?: string;
}

export function FiscalInternalStatusBadge({ status, className }: Props) {
  const info = getFiscalInternalStatus(status);
  const Icon = info.icon;
  return (
    <Badge variant="outline" className={cn("text-xs font-medium gap-1", info.classes, className)}>
      <Icon className="h-3 w-3" />
      {info.label}
    </Badge>
  );
}

export function FiscalSefazStatusBadge({ status, className }: Props) {
  const info = getFiscalSefazStatus(status);
  const Icon = info.icon;
  return (
    <Badge variant="outline" className={cn("text-xs font-medium gap-1", info.classes, className)}>
      <Icon className="h-3 w-3" />
      {info.label}
    </Badge>
  );
}
