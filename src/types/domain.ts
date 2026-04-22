/**
 * Domain types — centralized aliases derived from the Supabase-generated schema.
 *
 * Every entity used throughout the ERP should be imported from here instead of
 * being re-declared locally in each page or component. This guarantees a single
 * source of truth and prevents type drift.
 *
 * Usage:
 *   import type { Produto, Cliente, LancamentoFinanceiro } from "@/types/domain";
 */

import type { Database } from "@/integrations/supabase/types";

// ── Helper generics ──────────────────────────────────────────────────────────

/** Shorthand to extract the Row type from a public table. */
export type TableRow<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TableInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TableUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

// ── Cadastros ────────────────────────────────────────────────────────────────

export type Produto = TableRow<"produtos"> & {
  grupos_produto?: { nome: string } | null;
};

export type Cliente = TableRow<"clientes"> & {
  grupos_economicos?: { nome: string } | null;
};

export type Fornecedor = TableRow<"fornecedores">;

export type Funcionario = TableRow<"funcionarios">;

// ── Sócios e Participações ───────────────────────────────────────────────────

export type Socio = TableRow<"socios">;
export type SocioParticipacao = TableRow<"socios_participacoes">;
export type SocioParametro = TableRow<"socios_parametros">;
export type ApuracaoSocietaria = TableRow<"apuracoes_societarias">;
export type ApuracaoSocietariaItem = TableRow<"apuracoes_societarias_itens"> & {
  socios?: { nome: string; cpf: string | null } | null;
};
export type SocioRetirada = TableRow<"socios_retiradas"> & {
  socios?: { nome: string } | null;
};

export type GrupoProduto = TableRow<"grupos_produto">;

export type GrupoEconomico = TableRow<"grupos_economicos">;

// ── Comercial ────────────────────────────────────────────────────────────────

export type Orcamento = TableRow<"orcamentos"> & {
  clientes?: { nome_razao_social: string } | null;
};

export type OrcamentoItem = TableRow<"orcamentos_itens"> & {
  produtos?: { nome: string; codigo_interno: string } | null;
};

export type OrdemVenda = TableRow<"ordens_venda"> & {
  clientes?: { nome_razao_social: string } | null;
  orcamentos?: { numero: string } | null;
};

export type OrdemVendaItem = TableRow<"ordens_venda_itens"> & {
  produtos?: { nome: string; codigo_interno: string } | null;
};

// ── Compras / Suprimentos ────────────────────────────────────────────────────

export type Compra = TableRow<"compras"> & {
  fornecedores?: { nome_razao_social: string } | null;
};

export type CompraItem = TableRow<"compras_itens"> & {
  produtos?: { nome: string } | null;
};

export type PedidoCompra = TableRow<"pedidos_compra"> & {
  fornecedores?: { nome_razao_social: string } | null;
  cotacoes_compra?: { numero: string } | null;
};

export type PedidoCompraItem = TableRow<"pedidos_compra_itens"> & {
  produtos?: { nome: string; codigo_interno: string } | null;
};

export type CotacaoCompra = TableRow<"cotacoes_compra">;
export type CotacaoCompraItem = TableRow<"cotacoes_compra_itens">;
export type CotacaoCompraProposta = TableRow<"cotacoes_compra_propostas">;

// ── Financeiro ───────────────────────────────────────────────────────────────

export type LancamentoFinanceiro = TableRow<"financeiro_lancamentos"> & {
  clientes?: { nome_razao_social: string } | null;
  fornecedores?: { nome_razao_social: string } | null;
  contas_bancarias?: { descricao: string; bancos?: { nome: string } | null } | null;
  contas_contabeis?: { codigo: string; descricao: string } | null;
};

/**
 * Alias re-exported for backward compatibility with local `Lancamento` types
 * used in Financeiro.tsx, FluxoCaixa.tsx, and Conciliacao.tsx.
 */
export type Lancamento = LancamentoFinanceiro;

export type BaixaFinanceira = TableRow<"financeiro_baixas"> & {
  contas_bancarias?: { descricao: string } | null;
};

export type ContaBancaria = TableRow<"contas_bancarias"> & {
  bancos?: { nome: string } | null;
};

export type ContaContabil = TableRow<"contas_contabeis">;

export type FormaPagamento = TableRow<"formas_pagamento">;

export type CaixaMovimento = TableRow<"caixa_movimentos">;

// ── Estoque ──────────────────────────────────────────────────────────────────

export type MovimentacaoEstoque = TableRow<"estoque_movimentos"> & {
  produtos?: { nome: string; sku?: string; codigo_interno?: string } | null;
};

// ── Fiscal ───────────────────────────────────────────────────────────────────

export type NotaFiscal = TableRow<"notas_fiscais"> & {
  fornecedores?: { nome_razao_social: string; cpf_cnpj?: string } | null;
  clientes?: { nome_razao_social: string } | null;
  ordens_venda?: { numero: string } | null;
};

export type NotaFiscalItem = TableRow<"notas_fiscais_itens"> & {
  produtos?: { nome: string; codigo_interno?: string } | null;
};

// ── RH ───────────────────────────────────────────────────────────────────────

export type FolhaPagamento = TableRow<"folha_pagamento"> & {
  funcionarios?: { nome: string } | null;
};

// ── Empresa / Config ─────────────────────────────────────────────────────────

export type EmpresaConfig = TableRow<"empresa_config">;
export type AppConfiguracao = TableRow<"app_configuracoes">;

// ── Importação ───────────────────────────────────────────────────────────────

export type ImportacaoLote = TableRow<"importacao_lotes">;
export type ImportacaoLog = TableRow<"importacao_logs">;

// ── Auditoria ────────────────────────────────────────────────────────────────

export type AuditoriaLog = TableRow<"auditoria_logs">;

// ── Banco ────────────────────────────────────────────────────────────────────

export type Banco = TableRow<"bancos">;

// ── Logística ────────────────────────────────────────────────────────────────

export type ClienteTransportadora = TableRow<"cliente_transportadoras">;

// ── Comunicação ──────────────────────────────────────────────────────────────

export type RegistroComunicacao = TableRow<"cliente_registros_comunicacao">;
