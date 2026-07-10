import { extrairDocumento } from "@/services/ia/extracaoDocumento.service";
import type { StagedTx } from "../types";

/** Extrai transações de PDF de extrato via edge function `ia-extracao-documento`. */
export async function adaptPDF(file: File): Promise<StagedTx[]> {
  const res = await extrairDocumento(file, "extrato");
  if (res.tipo !== "extrato") return [];
  return res.dados.lancamentos.map((l, i) => {
    const valor = l.tipo === "credito" ? Math.abs(l.valor) : -Math.abs(l.valor);
    return {
      id: `pdf-${i}-${l.data}-${valor}`,
      data: l.data,
      descricao: l.descricao,
      valor,
      tipo: valor >= 0 ? "C" : "D",
    } as StagedTx;
  });
}