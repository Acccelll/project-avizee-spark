import { parseOFX } from "@/lib/parseOFX";
import { fromOFX } from "@/lib/ofx/canonical";
import type { StagedTx } from "../types";

export function adaptOFX(text: string): StagedTx[] {
  return parseOFX(text).map((t) => {
    const c = fromOFX(t);
    return {
      id: c.id,
      data: c.data,
      descricao: c.descricao,
      valor: c.valor,
      tipo: c.tipo === "credito" ? "C" : "D",
      natureza: c.natureza,
      favorecido: c.favorecido,
      favorecido_documento: c.favorecido_documento,
      forma_pagamento: c.forma_pagamento,
      documento: c.documento,
      categoria_sugerida: c.categoria_sugerida,
      origem_padrao: c.origem_padrao,
    };
  });
}