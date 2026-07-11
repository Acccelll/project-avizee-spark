import type { FaturaImportInput, LancamentoImport } from "./types";
import { parseBrDate, parseBrNumber, parseDataExtenso } from "./parseHelpers";

// Inter: "VENCIMENTO 07/05/2025", "VALOR TOTAL R$ 1.366,11", "CARTÃO 5497****6692"
// Linhas: "07 de abr. 2025  PAGAMENTO ON LINE  -  + R$ 3.061,21"
export function parseInter(text: string): FaturaImportInput {
  const clean = text.replace(/\s+/g, " ");
  const mVenc = clean.match(/VENCIMENTO\s+(\d{2}\/\d{2}\/\d{4})/i);
  const mValor = clean.match(/VALOR TOTAL\s+R\$\s*([\d.,]+)/i);
  const data_vencimento = mVenc ? parseBrDate(mVenc[1])! : "";
  const [ano, mes] = (data_vencimento || "").split("-");
  const competencia = ano && mes ? `${ano}-${mes}` : "";
  const valor_total = mValor ? parseBrNumber(mValor[1]) : 0;
  const anoRef = ano ? parseInt(ano, 10) : new Date().getFullYear();

  const lancamentos: LancamentoImport[] = [];
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  let cartaoAtual: string | undefined;
  const reCartao = /CART[ÃA]O\s+\d{4}\*{4}(\d{4})/i;
  // "07 de abr. 2025 PAGAMENTO ON LINE - + R$ 3.061,21"
  const reLinha =
    /^(\d{1,2}\s+de\s+[a-zç]+\.?\s*\d{4})\s+(.+?)\s+([+-])?\s*R\$\s*([\d.]+,\d{2})$/i;
  const reParcela = /Parcela\s+(\d+)\s+de\s+(\d+)/i;

  for (const l of lines) {
    const c = l.match(reCartao);
    if (c) cartaoAtual = c[1];
    const m = l.match(reLinha);
    if (!m) continue;
    const dataISO = parseDataExtenso(m[1], anoRef);
    if (!dataISO) continue;
    const desc = m[2].replace(/\s+-\s*$/, "").trim();
    const sinal = m[3] === "+" ? -1 : 1;
    const valor = sinal * parseBrNumber(m[4]);
    const par = desc.match(reParcela);
    lancamentos.push({
      data_compra: dataISO,
      descricao: desc,
      valor,
      parcela_atual: par ? parseInt(par[1], 10) : undefined,
      parcela_total: par ? parseInt(par[2], 10) : undefined,
      ultimos4: cartaoAtual,
    });
  }

  return { emissor: "inter", competencia, data_vencimento, valor_total, lancamentos };
}