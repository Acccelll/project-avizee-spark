import { Tables } from "@/integrations/supabase/types";

// ─── Entity row types ────────────────────────────
export type FornecedorRow = Tables<"fornecedores">;
export type ProdutoRow = Tables<"produtos">;

// ─── FornecedorView typed query results ──────────
export interface CompraRow {
  id: string;
  numero: string;
  data_pedido: string | null;
  valor_total: number | null;
  status: string;
}

export type FinanceiroLancamentoRow = Tables<"financeiro_lancamentos">;

export interface ProdutoFornecedorRow {
  id: string;
  produto_id: string;
  fornecedor_id: string;
  preco_compra: number | null;
  lead_time_dias: number | null;
  referencia_fornecedor: string | null;
  descricao_fornecedor: string | null;
  eh_principal: boolean | null;
  unidade_fornecedor: string | null;
  created_at: string | null;
  produtos: { id: string; nome: string; sku: string } | null;
}

// ─── ProdutoView typed query results ─────────────
export interface HistoricoNfItemRow {
  quantidade: number | null;
  valor_unitario: number | null;
  notas_fiscais: {
    id: string;
    numero: string;
    tipo: string;
    data_emissao: string | null;
    fornecedores: { id: string; nome_razao_social: string } | null;
  } | null;
}

export interface ComposicaoItemRow {
  id: string | undefined;
  nome: string | undefined;
  sku: string | undefined;
  preco_custo: number | null | undefined;
  quantidade: number;
  ordem: number | null;
}

export interface MovimentoEstoqueRow {
  tipo: string;
  quantidade: number;
  motivo: string | null;
  created_at: string;
  saldo_anterior: number | null;
  saldo_atual: number | null;
}

export interface ProdutoFornecedorViewRow {
  preco_compra: number | null;
  lead_time_dias: number | null;
  referencia_fornecedor: string | null;
  eh_principal: boolean | null;
  unidade_fornecedor: string | null;
  fornecedores: { id: string; nome_razao_social: string } | null;
}
