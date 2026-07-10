export type OrigemImportacao = "ofx" | "pdf_cartao" | "csv" | "manual";

export interface StagedTx {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: "C" | "D";
  /** Enriquecimento canônico (Fase 1 — Motor Inteligente). Opcional para
   *  manter retrocompatibilidade com adapters legados (CSV/PDF). */
  natureza?: string;
  favorecido?: string;
  favorecido_documento?: string;
  forma_pagamento?: string;
  documento?: string;
  categoria_sugerida?: string;
  origem_padrao?: string;
}

export interface ImportacaoDocumentoResumo {
  documento_id: string;
  origem: OrigemImportacao;
  total: number;
  inseridas: number;
  com_sugestao: number;
}