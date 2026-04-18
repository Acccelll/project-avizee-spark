/**
 * drawerPermissions — fonte única de verdade para regras de "qual ação está disponível
 * para este registro neste status". Antes essa lógica vivia espalhada entre cada drawer
 * (`canConfirmar`, `canEstornar`, `canBaixa`, ...) e os parents que tomavam a mesma
 * decisão de outra forma. Centralizar evita drift e reduz bugs de UI mostrando ações
 * que o backend rejeita (ou escondendo ações válidas).
 *
 * Regra geral: cada função recebe o registro (e flags de contexto, ex: isAdmin) e
 * devolve um objeto `{ canX: boolean, ... }`. UI consome direto; nenhum efeito colateral.
 */

// ---------------- Pedido de Compra ----------------
export interface PedidoCompraLike {
  status?: string | null;
  ativo?: boolean | null;
}

export interface PedidoCompraPermissions {
  canSend: boolean;             // rascunho → enviado
  canReceive: boolean;          // enviado/aprovado → recebido (gera entrada estoque)
  canCancel: boolean;           // qualquer status ≠ recebido/cancelado
  canSolicitarAprovacao: boolean;
  canApprove: boolean;          // requer admin + status pendente_aprovacao
  canReject: boolean;           // idem
  canEdit: boolean;
  canDelete: boolean;
}

export function getPedidoCompraPermissions(
  p: PedidoCompraLike | null | undefined,
  isAdmin: boolean,
): PedidoCompraPermissions {
  const status = p?.status ?? "rascunho";
  const ativo = p?.ativo !== false;
  return {
    canSend: ativo && status === "rascunho",
    canReceive: ativo && (status === "enviado" || status === "aprovado"),
    canCancel: ativo && status !== "recebido" && status !== "cancelado",
    canSolicitarAprovacao: ativo && status === "rascunho",
    canApprove: ativo && isAdmin && status === "pendente_aprovacao",
    canReject: ativo && isAdmin && status === "pendente_aprovacao",
    canEdit: ativo && (status === "rascunho" || status === "enviado"),
    canDelete: status === "rascunho" || status === "cancelado",
  };
}

// ---------------- Nota Fiscal ----------------
export interface NotaFiscalLike {
  status?: string | null;
  tipo?: string | null;
}

export interface NotaFiscalPermissions {
  canConfirmar: boolean;
  canEstornar: boolean;
  canDevolucao: boolean;
  canEditar: boolean;
  canExcluir: boolean;
  canReenviarEmail: boolean;
}

export function getNotaFiscalPermissions(
  nf: NotaFiscalLike | null | undefined,
): NotaFiscalPermissions {
  const status = nf?.status ?? "rascunho";
  return {
    canConfirmar: status === "rascunho" || status === "pendente",
    canEstornar: status === "emitida" || status === "autorizada",
    canDevolucao: status === "emitida" || status === "autorizada",
    canEditar: status === "rascunho" || status === "pendente",
    canExcluir: status === "rascunho" || status === "cancelada",
    canReenviarEmail: status === "emitida" || status === "autorizada",
  };
}

// ---------------- Financeiro (Lançamento) ----------------
export interface FinanceiroLancamentoLike {
  status?: string | null;
  saldo_restante?: number | null;
  valor?: number | null;
  valor_pago?: number | null;
}

export interface FinanceiroPermissions {
  canBaixa: boolean;       // lançamento aberto/parcial
  canEstorno: boolean;     // tem baixa lançada
  canEditar: boolean;
  canExcluir: boolean;
}

export function getFinanceiroPermissions(
  l: FinanceiroLancamentoLike | null | undefined,
): FinanceiroPermissions {
  const status = l?.status ?? "aberto";
  const isOpenOrPartial = status === "aberto" || status === "parcial";
  const isPaid = status === "pago" || status === "parcial";
  return {
    canBaixa: isOpenOrPartial,
    canEstorno: isPaid,
    canEditar: status !== "estornado",
    canExcluir: status === "aberto",
  };
}

// ---------------- Helper compartilhado: atraso ----------------
/**
 * Retorna `true` se a data de vencimento (ISO ou Date) é anterior a hoje.
 * Comparação por dia (zera horas), evita falsos negativos por timezone.
 */
export function isVencido(dataVencimento: string | Date | null | undefined): boolean {
  if (!dataVencimento) return false;
  const d = typeof dataVencimento === "string" ? new Date(dataVencimento) : dataVencimento;
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dv = new Date(d);
  dv.setHours(0, 0, 0, 0);
  return dv.getTime() < today.getTime();
}
