import type { LucideIcon } from "lucide-react";
import {
  AlertOctagon,
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  BadgeCheck,
  ClipboardCheck,
  PackageMinus,
  RotateCcw,
  ShieldAlert,
  Undo2,
} from "lucide-react";

export const tipoMovConfig: Record<string, { label: string; icon: LucideIcon; className: string; direction: "in" | "out" | "neutral"; critical?: boolean }> = {
  entrada: { label: "Entrada", icon: ArrowUpCircle, className: "bg-success/10 text-success border-success/20", direction: "in" },
  saida: { label: "Saída", icon: ArrowDownCircle, className: "bg-orange-500/10 text-orange-700 border-orange-300", direction: "out" },
  ajuste: { label: "Ajuste Manual", icon: ShieldAlert, className: "bg-warning/10 text-warning border-warning/20", direction: "neutral", critical: true },
  reserva: { label: "Reserva", icon: PackageMinus, className: "bg-blue-500/10 text-blue-700 border-blue-300", direction: "out" },
  liberacao_reserva: { label: "Liberação de Reserva", icon: BadgeCheck, className: "bg-cyan-500/10 text-cyan-700 border-cyan-300", direction: "in" },
  estorno: { label: "Estorno", icon: Undo2, className: "bg-purple-500/10 text-purple-700 border-purple-300", direction: "neutral" },
  inventario: { label: "Inventário", icon: ClipboardCheck, className: "bg-indigo-500/10 text-indigo-700 border-indigo-300", direction: "neutral" },
  perda_avaria: { label: "Perda / Avaria", icon: AlertOctagon, className: "bg-destructive/10 text-destructive border-destructive/20", direction: "out", critical: true },
  transferencia: { label: "Transferência", icon: ArrowLeftRight, className: "bg-muted text-muted-foreground border-border", direction: "neutral" },
};

export const origemConfig: Record<string, { label: string; className: string; emphasis?: "low" | "high" }> = {
  manual: { label: "Manual", className: "bg-warning/10 text-warning border-warning/30", emphasis: "high" },
  compra: { label: "Compra", className: "bg-primary/10 text-primary border-primary/20" },
  pedido_compra: { label: "Pedido de Compra", className: "bg-primary/10 text-primary border-primary/20" },
  venda: { label: "Venda", className: "bg-success/10 text-success border-success/20" },
  pedido: { label: "Pedido de Venda", className: "bg-blue-500/10 text-blue-700 border-blue-300" },
  fiscal: { label: "Fiscal", className: "bg-purple-500/10 text-purple-700 border-purple-300" },
  nota_fiscal: { label: "Nota Fiscal", className: "bg-purple-500/10 text-purple-700 border-purple-300" },
  ajuste: { label: "Ajuste", className: "bg-warning/10 text-warning border-warning/20", emphasis: "high" },
  estorno_fiscal: { label: "Estorno Fiscal", className: "bg-muted text-muted-foreground border-border" },
};

export function getTipoMovConfig(tipo: string) {
  return tipoMovConfig[tipo] ?? {
    label: tipo.replaceAll("_", " "),
    icon: RotateCcw,
    className: "bg-muted text-muted-foreground border-border",
    direction: "neutral" as const,
  };
}

export function getOrigemConfig(origem: string | null | undefined) {
  if (!origem) {
    return {
      label: "Sem origem",
      className: "bg-muted text-muted-foreground border-border",
      emphasis: "low" as const,
    };
  }
  return origemConfig[origem] ?? {
    label: origem.replaceAll("_", " "),
    className: "bg-muted text-muted-foreground border-border",
    emphasis: "low" as const,
  };
}
