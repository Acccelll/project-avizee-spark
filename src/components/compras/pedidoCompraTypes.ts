export interface PedidoCompra {
  id: string;
  numero?: string | null;
  fornecedor_id: string | number | null;
  data_pedido: string;
  data_entrega_prevista: string | null;
  data_entrega_real: string | null;
  valor_total: number | null;
  frete_valor: number | null;
  condicao_pagamento: string | null;
  condicoes_pagamento?: string | null;
  status: string;
  observacoes: string | null;
  cotacao_compra_id: string | number | null;
  ativo?: boolean | null;
  created_at?: string | null;
  fornecedores?: {
    nome_razao_social: string | null;
    cpf_cnpj?: string | null;
  } | null;
}

export interface FornecedorOptionRow {
  id: string | number;
  nome_razao_social: string | null;
  cpf_cnpj?: string | null;
  ativo?: boolean | null;
}

export interface ProdutoOptionRow {
  id: string | number;
  nome: string | null;
  codigo_interno?: string | null;
  preco_venda?: number | null;
  preco_custo?: number | null;
  unidade_medida?: string | null;
  ativo?: boolean | null;
}

export const emptyPedidoForm = {
  fornecedor_id: "",
  data_pedido: new Date().toISOString().split("T")[0],
  data_entrega_prevista: "",
  data_entrega_real: "",
  frete_valor: "",
  condicao_pagamento: "",
  status: "rascunho",
  observacoes: "",
};

export const pedidoNumero = (p: Pick<PedidoCompra, "id" | "numero">) =>
  p.numero || `PC-${p.id}`;
