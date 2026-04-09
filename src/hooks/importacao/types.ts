export type ImportType = "produtos" | "clientes" | "fornecedores";
export type ImportSource = "cadastros" | "estoque" | "xml" | "faturamento" | "financeiro";

export interface Mapping {
  [key: string]: string;
}
