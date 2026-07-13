import { extractPdfText } from "./pdfText";
import { parseC6 } from "./c6Parser";
import { parseInter } from "./interParser";
import { parseRecargaPay } from "./recargapayParser";
import type { EmissorCartao, FaturaImportInput } from "./types";

export function detectarEmissor(texto: string): EmissorCartao | null {
  if (/C6\s*BANK|C6BANK/i.test(texto)) return "c6";
  if (/banco\s*inter|BANCO INTER S\/A/i.test(texto)) return "inter";
  if (/RecargaPay|RECARGAPAY/i.test(texto)) return "recargapay";
  return null;
}

export async function parseFaturaPdf(file: File): Promise<FaturaImportInput> {
  const texto = await extractPdfText(file);
  if (texto.trim().length < 200) {
    throw new Error(
      "PDF sem texto extraível — reexporte a fatura original a partir do app/portal do emissor ou importe o OFX correspondente.",
    );
  }
  const emissor = detectarEmissor(texto);
  if (!emissor) throw new Error("Emissor não reconhecido. Suportados: C6, Inter, RecargaPay.");
  if (emissor === "c6") return parseC6(texto);
  if (emissor === "inter") return parseInter(texto);
  return parseRecargaPay(texto);
}