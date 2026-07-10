/**
 * Modelo canônico de transação financeira — Fase 1 do Motor Inteligente
 * de Importação. Independente do formato de origem (OFX, CSV, PDF), o
 * ERP consome `TransacaoCanonica`. Ver docs/financeiro-motor-importacao-ofx.md.
 */
import type { OFXTransaction } from "@/lib/parseOFX";
import { canonizarTrntype, type NaturezaCanonica } from "./trntype";
import { extrairMemo, type MemoExtracao } from "./memoExtractors";

export interface TransacaoCanonica {
  id: string;
  data: string;
  valor: number;
  tipo: "credito" | "debito";
  descricao: string;
  natureza: NaturezaCanonica;
  favorecido?: string;
  favorecido_documento?: string;
  forma_pagamento?: MemoExtracao["forma_pagamento"];
  documento?: string;
  categoria_sugerida?: string;
  origem_padrao?: string;
  raw: {
    trntype?: string;
    memo?: string;
    name?: string;
    checknum?: string;
    refnum?: string;
  };
}

export function fromOFX(tx: OFXTransaction): TransacaoCanonica {
  const memoFonte = tx.memo || tx.name || tx.descricao;
  const extraido = extrairMemo(memoFonte);
  const natureza = canonizarTrntype(tx.trntype);
  const forma = extraido.forma_pagamento
    ?? (natureza === "pix" ? "pix" : undefined)
    ?? (natureza === "cheque" ? undefined : undefined);

  return {
    id: tx.id,
    data: tx.data,
    valor: tx.valor,
    tipo: tx.valor >= 0 ? "credito" : "debito",
    descricao: tx.descricao,
    natureza,
    favorecido: extraido.favorecido,
    favorecido_documento: extraido.favorecido_documento,
    forma_pagamento: forma,
    documento: extraido.documento ?? tx.checknum ?? tx.refnum,
    categoria_sugerida: extraido.categoria_sugerida,
    origem_padrao: extraido.origem_padrao,
    raw: {
      trntype: tx.trntype,
      memo: tx.memo,
      name: tx.name,
      checknum: tx.checknum,
      refnum: tx.refnum,
    },
  };
}