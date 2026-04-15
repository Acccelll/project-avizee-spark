import type { Orcamento, OrdemVenda, PedidoCompra } from "@/types/domain";

export interface DashboardDateRange {
  dateFrom?: string;
  dateTo?: string;
}

export type RecentOrcamento = Orcamento;
export type BacklogOv = OrdemVenda;
export type CompraAguardando = PedidoCompra;

export interface FinRow {
  valor: number;
  saldo_restante: number | null;
  status: string | null;
}

export interface NfRow {
  status: string | null;
  valor_total: number | null;
}

export interface RecDataRow {
  clientes?: { nome_razao_social: string } | null;
  valor: number;
  saldo_restante: number | null;
  status: string | null;
}

export interface NfItemRow {
  quantidade: number | null;
  valor_unitario: number | null;
  produtos?: { nome: string } | null;
}

export interface ProdRow {
  estoque_minimo: number;
  estoque_atual: number | null;
  id: string;
  nome: string;
  codigo_interno: string | null;
  unidade_medida: string;
}

export interface DailyFinRow {
  data_vencimento: string;
  valor: number;
  saldo_restante: number | null;
  status: string | null;
}

export interface DailyNfRow {
  data_emissao: string;
  valor_total: number | null;
}

export interface DailyPoint {
  dia: string;
  valor: number;
}

export interface TopPoint {
  nome: string;
  valor: number;
}

export interface DashboardStats {
  produtos: number;
  clientes: number;
  fornecedores: number;
  orcamentos: number;
  compras: number;
  contasReceber: number;
  contasPagar: number;
  contasVencidas: number;
  totalReceber: number;
  totalPagar: number;
}

export interface FiscalStats {
  emitidas: number;
  pendentes: number;
  canceladas: number;
  valorEmitidas: number;
}

export interface FaturamentoStats {
  mesAtual: number;
  mesAnterior: number;
}
