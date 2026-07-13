import type { FaturaImportInput, LancamentoImport } from "./types";
import {
  parseBrDate,
  parseBrNumber,
  competenciaDoFechamento,
  ehLinhaPagamentoFatura,
  extrairFechamentoDoPeriodo,
  validarFatura,
} from "./parseHelpers";

// RecargaPay: "Total da fatura R$ 3.869,50" "Data de vencimento 11/05/2026"
// Linhas: "01/05/2026  Descrição  - R$ 208,00"
export function parseRecargaPay(text: string): FaturaImportInput {
  const clean = text.replace(/\s+/g, " ");
  const mVenc = clean.match(/(?:Data de )?[Vv]encimento\s+(\d{2}\/\d{2}\/\d{4})/);
  const mValor = clean.match(/Total da fatura\s+R\$\s*([\d.,]+)/i);
  const data_vencimento = mVenc ? parseBrDate(mVenc[1])! : "";
  const data_fechamento = extrairFechamentoDoPeriodo(clean) ?? undefined;
  const competencia = competenciaDoFechamento(data_fechamento, data_vencimento);
  const valor_total = mValor ? parseBrNumber(mValor[1]) : 0;

  const lancamentos: LancamentoImport[] = [];
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  let cartaoAtual: string | undefined;
  const reCartao = /Cart[ãa]o[\s•]+(?:[•\s\d]*?)(\d{4})\b/i;
  const reLinha =
    /^(\d{2}\/\d{2}\/\d{4})?\s*(.+?)\s+([+\-−])\s*R\$\s*([\d.]+,\d{2})$/;
  const reParcela = /\((\d+)\/(\d+)\)/;
  let ultimaData: string | null = null;
  let dentroProxima = false;

  for (const l of lines) {
    if (/Pr[óo]xima fatura/i.test(l)) { dentroProxima = true; continue; }
    if (dentroProxima) continue; // ignora próximas parcelas
    const c = l.match(reCartao);
    if (c) { cartaoAtual = c[1]; continue; }
    const m = l.match(reLinha);
    if (!m) continue;
    const dataISO = m[1] ? parseBrDate(m[1]) : ultimaData;
    if (!dataISO) continue;
    ultimaData = dataISO;
    const desc = m[2].trim();
    if (ehLinhaPagamentoFatura(desc)) continue;
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

  const val = validarFatura(valor_total, lancamentos);
  return {
    emissor: "recargapay",
    competencia,
    data_vencimento,
    data_fechamento,
    valor_total,
    lancamentos,
    aviso: val.aviso,
  };
}