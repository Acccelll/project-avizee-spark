import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Ban, CheckCircle2, Clock3, FileDown, FileEdit, HelpCircle, ShieldCheck, XCircle } from "lucide-react";

export type FiscalInternalStatus =
  | "pendente"
  | "rascunho"
  | "confirmada"
  | "autorizada"
  | "importada"
  | "rejeitada"
  | "cancelada"
  | "cancelada_sefaz"
  | "inutilizada";

export type FiscalSefazStatus =
  | "nao_enviada"
  | "pendente_envio"
  | "em_processamento"
  | "autorizada"
  | "rejeitada"
  | "cancelada_sefaz"
  | "inutilizada"
  | "importada_externa";

export interface FiscalStatusVisual {
  label: string;
  classes: string;
  icon: LucideIcon;
  description: string;
}

const DEFAULT_INTERNAL: FiscalStatusVisual = {
  label: "Status desconhecido",
  classes: "bg-muted text-muted-foreground border-muted",
  icon: HelpCircle,
  description: "Status interno não mapeado no front.",
};

const DEFAULT_SEFAZ: FiscalStatusVisual = {
  label: "Não enviado",
  classes: "bg-muted text-muted-foreground border-muted",
  icon: Clock3,
  description: "Documento ainda não enviado para SEFAZ.",
};

export const fiscalInternalStatusMap: Record<string, FiscalStatusVisual> = {
  pendente: {
    label: "Pendente",
    classes: "bg-warning/10 text-warning border-warning/20",
    icon: Clock3,
    description: "Rascunho operacional. Sem impacto definitivo em estoque e financeiro.",
  },
  rascunho: {
    label: "Rascunho",
    classes: "bg-muted text-muted-foreground border-muted",
    icon: FileEdit,
    description: "Documento em preparação no ERP.",
  },
  confirmada: {
    label: "Confirmada",
    classes: "bg-primary/10 text-primary border-primary/20",
    icon: CheckCircle2,
    description: "Confirmação operacional concluída. Estoque e financeiro já impactados.",
  },
  autorizada: {
    label: "Autorizada",
    classes: "bg-success/10 text-success border-success/20",
    icon: ShieldCheck,
    description: "Nota autorizada e vigente fiscalmente.",
  },
  importada: {
    label: "Importada",
    classes: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
    icon: FileDown,
    description: "Nota importada de fonte externa.",
  },
  rejeitada: {
    label: "Rejeitada",
    classes: "bg-destructive/10 text-destructive border-destructive/20",
    icon: XCircle,
    description: "Rejeição fiscal. Requer correção para novo processamento.",
  },
  cancelada: {
    label: "Cancelada",
    classes: "bg-destructive/10 text-destructive border-destructive/20",
    icon: Ban,
    description: "Documento cancelado no ERP.",
  },
  cancelada_sefaz: {
    label: "Cancelada SEFAZ",
    classes: "bg-destructive/10 text-destructive border-destructive/20",
    icon: Ban,
    description: "Cancelamento homologado na SEFAZ.",
  },
  inutilizada: {
    label: "Inutilizada",
    classes: "bg-muted text-muted-foreground border-muted",
    icon: AlertTriangle,
    description: "Faixa/numeração inutilizada junto à SEFAZ.",
  },
};

export const fiscalSefazStatusMap: Record<string, FiscalStatusVisual> = {
  nao_enviada: {
    label: "Não enviada",
    classes: "bg-muted text-muted-foreground border-muted",
    icon: Clock3,
    description: "NF ainda não enviada para autorização na SEFAZ.",
  },
  pendente_envio: {
    label: "Pendente de envio",
    classes: "bg-warning/10 text-warning border-warning/20",
    icon: Clock3,
    description: "Documento pronto para envio, aguardando processamento.",
  },
  em_processamento: {
    label: "Em processamento",
    classes: "bg-primary/10 text-primary border-primary/20",
    icon: Clock3,
    description: "SEFAZ recebeu e está processando a solicitação.",
  },
  autorizada: {
    label: "Autorizada",
    classes: "bg-success/10 text-success border-success/20",
    icon: ShieldCheck,
    description: "Autorizada eletronicamente pela SEFAZ.",
  },
  rejeitada: {
    label: "Rejeitada",
    classes: "bg-destructive/10 text-destructive border-destructive/20",
    icon: XCircle,
    description: "Rejeição retornada pela SEFAZ.",
  },
  cancelada_sefaz: {
    label: "Cancelada",
    classes: "bg-destructive/10 text-destructive border-destructive/20",
    icon: Ban,
    description: "Cancelamento aprovado na SEFAZ.",
  },
  inutilizada: {
    label: "Inutilizada",
    classes: "bg-muted text-muted-foreground border-muted",
    icon: AlertTriangle,
    description: "Numeração inutilizada na SEFAZ.",
  },
  importada_externa: {
    label: "Importada externa",
    classes: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
    icon: FileDown,
    description: "Documento emitido fora do ERP e apenas importado.",
  },
};

export const fiscalInternalStatusOptions = [
  "pendente",
  "rascunho",
  "confirmada",
  "autorizada",
  "importada",
  "rejeitada",
  "cancelada",
  "cancelada_sefaz",
  "inutilizada",
] as const;

export const fiscalSefazStatusOptions = [
  "nao_enviada",
  "pendente_envio",
  "em_processamento",
  "autorizada",
  "rejeitada",
  "cancelada_sefaz",
  "inutilizada",
  "importada_externa",
] as const;

export function getFiscalInternalStatus(status?: string | null): FiscalStatusVisual {
  if (!status) return DEFAULT_INTERNAL;
  return fiscalInternalStatusMap[status] ?? { ...DEFAULT_INTERNAL, label: status };
}

export function getFiscalSefazStatus(status?: string | null): FiscalStatusVisual {
  if (!status) return DEFAULT_SEFAZ;
  return fiscalSefazStatusMap[status] ?? { ...DEFAULT_SEFAZ, label: status };
}

export function canConfirmFiscal(status?: string | null) {
  return status === "pendente" || status === "rascunho";
}

export function canEditFiscal(status?: string | null) {
  return !["cancelada", "cancelada_sefaz", "inutilizada"].includes(status || "");
}

export function isFiscalReadOnly(status?: string | null) {
  return ["cancelada", "cancelada_sefaz", "inutilizada"].includes(status || "");
}

export function isFiscalStructurallyLocked(status?: string | null) {
  return ["confirmada", "autorizada", "importada"].includes(status || "");
}

export function canEstornarFiscal(status?: string | null) {
  return status === "confirmada";
}

export function canDevolverFiscal(status?: string | null, tipo?: string | null, tipoOperacao?: string | null) {
  return status === "confirmada" && tipo === "saida" && (tipoOperacao || "normal") === "normal";
}
