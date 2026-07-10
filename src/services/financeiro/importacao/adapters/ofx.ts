import { parseOFX } from "@/lib/parseOFX";
import type { StagedTx } from "../types";

export function adaptOFX(text: string): StagedTx[] {
  return parseOFX(text).map((t) => ({
    id: t.id,
    data: t.data,
    descricao: t.descricao,
    valor: t.valor,
    tipo: t.valor >= 0 ? "C" : "D",
  }));
}