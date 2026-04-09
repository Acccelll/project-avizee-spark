// src/types/erp.ts
export enum StatusFamily {
  RASCUNHO = 'rascunho',
  PENDENTE = 'pendente',
  APROVADO = 'aprovado',
  PROCESSANDO = 'processando',
  CONCLUIDO = 'concluido',
  PARCIAL = 'parcial',
  CANCELADO = 'cancelado',
  VENCIDO = 'vencido',
  BLOQUEADO = 'bloqueado',
}

export enum StatusIntention {
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

export interface StatusBadgeProps {
  status: StatusFamily;
  intention?: StatusIntention;
}

export interface SummaryCardProps {
  title: string;
  value: string | number;
  variation?: string | number;
  icon?: React.ReactNode;
  onClick?: () => void;
  colorFamily?: string;
}

export const statusConfig: Record<StatusFamily, { icon: string; color: string; label: string }> = {
  [StatusFamily.RASCUNHO]: { icon: '📝', color: 'gray', label: 'Rascunho' },
  [StatusFamily.PENDENTE]: { icon: '⏳', color: 'orange', label: 'Pendente' },
  [StatusFamily.APROVADO]: { icon: '✅', color: 'green', label: 'Aprovado' },
  [StatusFamily.PROCESSANDO]: { icon: '⚙️', color: 'blue', label: 'Processando' },
  [StatusFamily.CONCLUIDO]: { icon: '✔️', color: 'green', label: 'Concluído' },
  [StatusFamily.PARCIAL]: { icon: '⚠️', color: 'yellow', label: 'Parcial' },
  [StatusFamily.CANCELADO]: { icon: '❌', color: 'red', label: 'Cancelado' },
  [StatusFamily.VENCIDO]: { icon: '⏰', color: 'red', label: 'Vencido' },
  [StatusFamily.BLOQUEADO]: { icon: '🚫', color: 'purple', label: 'Bloqueado' },
};