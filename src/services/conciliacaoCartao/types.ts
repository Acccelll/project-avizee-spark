export type EmissorCartao = "c6" | "inter" | "recargapay";

export interface LancamentoImport {
  data_compra: string; // YYYY-MM-DD
  descricao: string;
  estabelecimento?: string;
  valor: number; // valores positivos = despesa; negativos = estorno/pagamento
  parcela_atual?: number;
  parcela_total?: number;
  ultimos4?: string;
}

export interface FaturaImportInput {
  emissor: EmissorCartao;
  competencia: string; // YYYY-MM
  data_vencimento: string; // YYYY-MM-DD
  data_fechamento?: string;
  valor_total: number;
  lancamentos: LancamentoImport[];
  /** Aviso não-bloqueante (ex.: Σ(linhas) ≠ valor_total). */
  aviso?: string;
}