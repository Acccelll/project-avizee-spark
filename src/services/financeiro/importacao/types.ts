export type OrigemImportacao = "OFX" | "PDF" | "CSV" | "CARTAO_PDF";

export interface StagedTx {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: "C" | "D";
}

export interface ImportacaoDocumentoResumo {
  documento_id: string;
  origem: OrigemImportacao;
  total: number;
  inseridas: number;
  com_sugestao: number;
}