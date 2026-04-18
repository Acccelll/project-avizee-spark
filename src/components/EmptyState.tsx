/**
 * Adaptador de compatibilidade para `EmptyState`.
 *
 * Mantém a API legada `actionLabel` + `onAction` traduzindo para o
 * componente canônico em `@/components/ui/empty-state`, que aceita
 * `action: ReactNode`. Novos consumidores devem importar diretamente de
 * `@/components/ui/empty-state`.
 */
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState as BaseEmptyState } from "@/components/ui/empty-state";

interface LegacyEmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: LegacyEmptyStateProps) {
  const action =
    actionLabel && onAction ? (
      <Button onClick={onAction} className="gap-2">
        {actionLabel}
      </Button>
    ) : undefined;

  return (
    <BaseEmptyState
      icon={icon}
      title={title}
      description={description}
      action={action}
    />
  );
}
