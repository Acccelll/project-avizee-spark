import type { FaturaImportInput, LancamentoImport } from "./types";
import {
  parseBrNumber,
  parseMesAbrev,
  competenciaDoFechamento,
  ehLinhaPagamentoFatura,
  ajustarAnoLinha,
  validarFatura,
} from "./parseHelpers";

// C6: vencimento "10 de Maio", valor "R$ 1.018,69", transações "26 dez  DESCRIÇÃO ...  15,05"
export function parseC6(text: string): FaturaImportInput {
  const clean = text.replace(/\s+/g, " ");
  const mVenc = clean.match(/Vencimento[:\s]+(\d{1,2})\s+de\s+([A-Za-zç]+)(?:\s+de\s+(\d{4}))?/i);
  const mValor = clean.match(/Valor da fatura[:\s]+R\$\s*([\d.,]+)/i);
  const mFech = clean.match(/fechamento desta fatura em\s+(\d{2})\/(\d{2})\/(\d{2,4})/i);

  const MESES: Record<string, number> = {
    janeiro: 1, fevereiro: 2, março: 3, marco: 3, abril: 4, maio: 5, junho: 6,
    julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
  };
  const now = new Date();
  const anoRef = mVenc?.[3] ? parseInt(mVenc[3], 10) : now.getFullYear();
  const mesVenc = mVenc ? MESES[mVenc[2].toLowerCase()] ?? 1 : 1;
  const diaVenc = mVenc ? parseInt(mVenc[1], 10) : 1;
  const data_vencimento = `${anoRef}-${String(mesVenc).padStart(2, "0")}-${String(diaVenc).padStart(2, "0")}`;
  const valor_total = mValor ? parseBrNumber(mValor[1]) : 0;
  const data_fechamento = mFech
    ? `${mFech[3].length === 2 ? "20" + mFech[3] : mFech[3]}-${mFech[2]}-${mFech[1]}`
    : undefined;
  const competencia = competenciaDoFechamento(data_fechamento, data_vencimento);
  const mesFechamento = data_fechamento
    ? parseInt(data_fechamento.slice(5, 7), 10)
    : mesVenc; // fallback: mês do vencimento
  const anoFechamento = data_fechamento
    ? parseInt(data_fechamento.slice(0, 4), 10)
    : anoRef;

  const lancamentos: LancamentoImport[] = [];
  // Divide por linhas originais
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  let cartaoAtual: string | undefined;
  const reCartao = /Final\s+(\d{4})/i;
  // padrão: "26 dez DESCRIÇÃO ... 15,05"  ou com "Parcela X/Y"
  const reLinha =
    /^(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+(.+?)\s+([\d.]+,\d{2})$/i;
  const reParcela = /Parcela\s+(\d+)\/(\d+)/i;

  for (const l of lines) {
    const c = l.match(reCartao);
    if (c) cartaoAtual = c[1];
    const m = l.match(reLinha);
    if (!m) continue;
    const desc = m[3].trim();
    if (ehLinhaPagamentoFatura(desc)) continue;
    const mesKey = m[2].toLowerCase().slice(0, 3);
    const MES_NUM: Record<string, number> = {
      jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
      jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
    };
    const mesLinha = MES_NUM[mesKey] ?? 0;
    const anoLinha = ajustarAnoLinha(mesLinha, mesFechamento, anoFechamento);
    const dataISO = parseMesAbrev(m[1], m[2], anoLinha);
    if (!dataISO) continue;
    const par = desc.match(reParcela);
    lancamentos.push({
      data_compra: dataISO,
      descricao: desc,
      valor: parseBrNumber(m[4]),
      parcela_atual: par ? parseInt(par[1], 10) : undefined,
      parcela_total: par ? parseInt(par[2], 10) : undefined,
      ultimos4: cartaoAtual,
    });
  }

  const val = validarFatura(valor_total, lancamentos);
  return {
    emissor: "c6",
    competencia,
    data_vencimento,
    data_fechamento,
    valor_total,
    lancamentos,
    aviso: val.aviso,
  };
}