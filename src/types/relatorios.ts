/**
 * Typed interfaces for every report row produced by relatorios.service.ts.
 * Each interface corresponds to one TipoRelatorio case.
 */

// ─── Estoque ────────────────────────────────────────────────────────────────

export interface EstoqueRow {
  codigo: string;
  produto: string;
  grupo: string;
  unidade: string;
  estoqueAtual: number;
  estoqueMinimo: number;
  criticidade: "Zerado" | "Abaixo do mínimo" | "OK";
  custoUnit: number;
  vendaUnit: number;
  totalCusto: number;
  totalVenda: number;
}

export interface MovimentoEstoqueRow {
  data: string;
  produto: string;
  codigo: string;
  tipo: string;
  quantidade: number;
  saldoAnterior: number;
  saldoAtual: number;
  documento: string;
  motivo: string;
}

// ─── Financeiro ─────────────────────────────────────────────────────────────

export interface FinanceiroRow {
  tipo: "Receber" | "Pagar";
  parceiro: string;
  descricao: string;
  valor: number;
  valorEmAberto: number;
  atraso: number;
  status: string;
  vencimento: string | null;
  pagamento: string | null;
  banco: string;
  formaPagamento: string;
}

export interface FluxoCaixaRow {
  data: string | null;
  descricao: string;
  tipo: string;
  status: string;
  entrada: number;
  saida: number;
  saldo: number;
}

export interface AgingRow {
  tipo: "Receber" | "Pagar";
  descricao: string;
  parceiro: string;
  valor: number;
  vencimento: string;
  diasVencido: number;
  faixa: "A vencer" | "1-30 dias" | "31-60 dias" | "61-90 dias" | "90+ dias";
}

export interface DreRow {
  linha: string;
  valor: number;
  tipo: "header" | "deducao" | "subtotal" | "resultado";
}

// ─── Vendas / Comercial ──────────────────────────────────────────────────────

export interface VendasRow {
  numero: string;
  cliente: string;
  emissao: string;
  valor: number;
  status: string;
  faturamento: string;
}

export interface FaturamentoRow {
  data: string;
  nf: string;
  modelo: string;
  cliente: string;
  ov: string;
  frete: number;
  desconto: number;
  impostos: number;
  valorTotal: number;
  receitaLiquida: number;
}

export interface VendasClienteRow {
  posicao: number;
  cliente: string;
  cnpj: string;
  pedidos: number;
  valorTotal: number;
  ticketMedio: number;
  participacao: number;
}

// ─── Compras ────────────────────────────────────────────────────────────────

export interface ComprasRow {
  numero: string;
  fornecedor: string;
  compra: string;
  prevista: string | null;
  entrega: string | null;
  valor: number;
  atraso: number;
  status: string;
}

export interface ComprasFornecedorRow {
  posicao: number;
  fornecedor: string;
  cnpj: string;
  pedidos: number;
  valorTotal: number;
  ticketMedio: number;
  participacao: number;
}

// ─── Produtos ───────────────────────────────────────────────────────────────

export interface CurvaAbcRow {
  posicao: number;
  codigo: string;
  produto: string;
  faturamento: number;
  percentual: number;
  acumulado: number;
  classe: "A" | "B" | "C";
}

export interface MargemProdutosRow {
  codigo: string;
  produto: string;
  grupo: string;
  custUnit: number;
  vendaUnit: number;
  lucroUnit: number;
  margem: number;
  markup: number;
  estoque: number;
}

export interface EstoqueMinimoRow {
  codigo: string;
  produto: string;
  grupo: string;
  unidade: string;
  estoqueAtual: number;
  estoqueMinimo: number;
  deficit: number;
  criticidade: "Zerado" | "Abaixo do mínimo";
  custoReposicao: number;
}

// ─── Divergências ────────────────────────────────────────────────────────────

export interface DivergenciasRow {
  tipo: "Pedido s/ NF" | "NF s/ Financeiro";
  referencia: string;
  parceiro: string;
  valor: number;
  status: string;
  criticidade: "Alta";
  observacao: string;
}

// ─── Union ───────────────────────────────────────────────────────────────────

export type AnyRelatorioRow =
  | EstoqueRow
  | MovimentoEstoqueRow
  | FinanceiroRow
  | FluxoCaixaRow
  | AgingRow
  | DreRow
  | VendasRow
  | FaturamentoRow
  | VendasClienteRow
  | ComprasRow
  | ComprasFornecedorRow
  | CurvaAbcRow
  | MargemProdutosRow
  | EstoqueMinimoRow
  | DivergenciasRow;

// ─── Filtros ─────────────────────────────────────────────────────────────────

export interface VendasFilters {
  dataInicio?: string;
  dataFim?: string;
  clienteIds?: string[];
  agrupamento?: "dia" | "semana" | "mes" | "padrao";
}

export interface FinanceiroFilters {
  dataInicio?: string;
  dataFim?: string;
  tiposFinanceiros?: string[];
  clienteIds?: string[];
}

export interface EstoqueFilters {
  grupoProdutoIds?: string[];
}
