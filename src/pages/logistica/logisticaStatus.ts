import { AlertTriangle, CheckCheck, Circle, Clock3, PackageCheck, PackageX, Truck } from "lucide-react";

export const ENTREGA_STATUS_ORDER = [
  "aguardando_separacao",
  "em_separacao",
  "separado",
  "aguardando_expedicao",
  "em_transporte",
  "entregue",
  "entrega_parcial",
  "ocorrencia",
  "cancelado",
] as const;

export type EntregaStatus = (typeof ENTREGA_STATUS_ORDER)[number];

export const ENTREGA_STATUS_META: Record<string, { label: string; badgeStatus: string; terminal?: boolean; sensivel?: boolean }> = {
  aguardando_separacao: { label: "Aguardando Separação", badgeStatus: "aguardando" },
  em_separacao: { label: "Em Separação", badgeStatus: "em_separacao" },
  separado: { label: "Separado", badgeStatus: "aprovado" },
  aguardando_expedicao: { label: "Aguardando Expedição", badgeStatus: "aguardando" },
  em_transporte: { label: "Em Transporte", badgeStatus: "enviado", sensivel: true },
  entregue: { label: "Entregue", badgeStatus: "entregue", terminal: true, sensivel: true },
  entrega_parcial: { label: "Entrega Parcial", badgeStatus: "parcial", sensivel: true },
  ocorrencia: { label: "Com Ocorrência", badgeStatus: "pendente", sensivel: true },
  cancelado: { label: "Cancelado", badgeStatus: "cancelado", terminal: true, sensivel: true },
};

export const ENTREGA_TERMINAL = new Set<string>(Object.entries(ENTREGA_STATUS_META).filter(([, m]) => m.terminal).map(([s]) => s));

export const RECEBIMENTO_STATUS_ORDER = [
  "pedido_emitido",
  "aguardando_envio_fornecedor",
  "em_transito",
  "recebimento_parcial",
  "recebido",
  "recebido_com_divergencia",
  "atrasado",
  "cancelado",
] as const;

export const RECEBIMENTO_STATUS_META: Record<string, { label: string; badgeStatus: string; terminal?: boolean }> = {
  pedido_emitido: { label: "Pedido Emitido", badgeStatus: "pendente" },
  aguardando_envio_fornecedor: { label: "Aguardando Envio", badgeStatus: "aguardando" },
  em_transito: { label: "Em Trânsito", badgeStatus: "enviado" },
  recebimento_parcial: { label: "Recebimento Parcial", badgeStatus: "parcial" },
  recebido: { label: "Recebido", badgeStatus: "entregue", terminal: true },
  recebido_com_divergencia: { label: "Com Divergência", badgeStatus: "pendente" },
  atrasado: { label: "Atrasado", badgeStatus: "vencido" },
  cancelado: { label: "Cancelado", badgeStatus: "cancelado", terminal: true },
};

export const RECEBIMENTO_TERMINAL = new Set<string>(Object.entries(RECEBIMENTO_STATUS_META).filter(([, m]) => m.terminal).map(([s]) => s));
export const RECEBIMENTO_STATUS_OFICIAL_PARCIAL = "recebimento_parcial";

export function normalizeRecebimentoStatus(status: string | null | undefined): string {
  if (!status) return "pedido_emitido";
  if (status === "recebido_parcial" || status === "parcialmente_recebido") {
    return RECEBIMENTO_STATUS_OFICIAL_PARCIAL;
  }
  return status;
}

export function getEntregaStatusCfg(status: string) {
  return ENTREGA_STATUS_META[status] ?? { label: status.replaceAll("_", " "), badgeStatus: "pendente" };
}

export function getRecebimentoStatusCfg(status: string) {
  return RECEBIMENTO_STATUS_META[status] ?? { label: status.replaceAll("_", " "), badgeStatus: "pendente" };
}

export function getRastreioStatusConsistencyBadge(remessaStatus: string, temEventos: boolean) {
  if (["entregue", "cancelado", "devolvido"].includes(remessaStatus)) return null;
  if (!temEventos) return { label: "Sem eventos", icon: Circle, className: "text-muted-foreground" };
  if (remessaStatus === "em_transito") return { label: "Em atualização", icon: Truck, className: "text-info" };
  if (remessaStatus === "postado" || remessaStatus === "coletado") return { label: "Aguardando trânsito", icon: Clock3, className: "text-warning" };
  if (remessaStatus === "entregue") return { label: "Conferir baixa", icon: PackageCheck, className: "text-success" };
  if (remessaStatus === "ocorrencia") return { label: "Atenção", icon: AlertTriangle, className: "text-destructive" };
  return { label: "Acompanhar", icon: CheckCheck, className: "text-muted-foreground" };
}

export function getRecebimentoSourceMeta(recebimentoReal: boolean) {
  if (recebimentoReal) {
    return {
      label: "Consolidado por itens",
      description: "Quantidades recebidas vieram de pedidos_compra_itens.quantidade_recebida.",
      icon: PackageCheck,
      className: "text-success",
    };
  }
  return {
    label: "Visão derivada de Compra",
    description: "Sem consolidação de recebimento no Logística: confirme no módulo Compras.",
    icon: PackageX,
    className: "text-warning",
  };
}
