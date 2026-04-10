export type ImportType = "produtos" | "clientes" | "fornecedores";
export type ImportSource = "cadastros" | "estoque" | "xml" | "faturamento" | "financeiro";

export interface Mapping {
  [key: string]: string;
}

/** Linha de prévia gerada pelo hook `useImportacaoFinanceiro`. */
export interface PreviewFinanceiroRow {
  tipo?: string;
  descricao?: string;
  valor?: number;
  data_vencimento?: string;
  cpf_cnpj?: string;
  observacoes?: string;
  entity_id?: string;
  entity_type?: "cliente" | "fornecedor";
  /** Indica se a linha passou na validação. */
  _valid: boolean;
  /** Lista de erros encontrados na validação. */
  _errors: string[];
  /** Número da linha no arquivo original (base 1, incluindo cabeçalho). */
  _originalLine: number;
  /** Dados brutos da linha original do arquivo. */
  _originalRow: Record<string, unknown>;
}
