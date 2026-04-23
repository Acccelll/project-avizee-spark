/**
 * Badges semânticas para auditoria — usam tokens do design system
 * em vez de cores hardcoded (`bg-red-100` etc).
 */

import {
  type AcaoMeta,
  type ActionVariant,
  type Criticality,
  CRITICALITY_STYLE,
  getAcaoMeta,
} from "./metadata";

const VARIANT_CLASS: Record<ActionVariant, string> = {
  success:
    "bg-success/15 text-success-foreground border border-success/30",
  info:
    "bg-info/15 text-info-foreground border border-info/30",
  destructive:
    "bg-destructive/15 text-destructive border border-destructive/30",
  warning:
    "bg-warning/15 text-warning-foreground border border-warning/30",
  muted:
    "bg-muted text-muted-foreground border border-border",
};

function classFor(variant: ActionVariant) {
  return VARIANT_CLASS[variant];
}

export function ActionBadge({ acao }: { acao: string | null | undefined }) {
  const meta: AcaoMeta = getAcaoMeta(acao);
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${classFor(meta.variant)}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export function CriticalityBadge({ level }: { level: Criticality }) {
  const style = CRITICALITY_STYLE[level];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classFor(style.variant)}`}
    >
      {style.label}
    </span>
  );
}

export function OrigemBadge({ origem }: { origem: "permission_audit" | "auditoria_logs" }) {
  const isGov = origem === "permission_audit";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
        isGov
          ? "bg-warning/15 text-warning-foreground border border-warning/30"
          : "bg-muted text-muted-foreground border border-border"
      }`}
      title={
        isGov
          ? "Trilha de governança (papéis, permissões, configurações)"
          : "Trilha operacional (CRUD em tabelas de domínio)"
      }
    >
      {isGov ? "Governança" : "Operacional"}
    </span>
  );
}
