/**
 * Parser OFX (SGML/XML). Produz LinhaExtratoNormalizadaInput[].
 * Suporta variantes com e sem cabeçalho SGML.
 */
import type { LinhaExtratoNormalizadaInput } from "./importService";

function tag(block: string, name: string): string | undefined {
  const re = new RegExp(`<${name}>([^<\\r\\n]*)`, "i");
  const m = block.match(re);
  return m ? m[1].trim() : undefined;
}

function parseOfxDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const clean = raw.replace(/\[.*$/, "").trim();
  const y = clean.slice(0, 4);
  const mo = clean.slice(4, 6);
  const d = clean.slice(6, 8);
  if (!y || !mo || !d) return null;
  return `${y}-${mo}-${d}`;
}

export interface OfxParseResult {
  linhas: LinhaExtratoNormalizadaInput[];
  periodo_inicio: string | null;
  periodo_fim: string | null;
  bank_id?: string;
  account_id?: string;
}

export function parseOfx(content: string): OfxParseResult {
  const normalized = content.replace(/\r\n?/g, "\n");
  const bankId = tag(normalized, "BANKID");
  const acctId = tag(normalized, "ACCTID");
  const dtStart = parseOfxDate(tag(normalized, "DTSTART"));
  const dtEnd = parseOfxDate(tag(normalized, "DTEND"));

  const linhas: LinhaExtratoNormalizadaInput[] = [];
  const stmtRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  const looseRegex = /<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>|$)/gi;
  const iter = normalized.match(/<\/STMTTRN>/i) ? stmtRegex : looseRegex;
  let match: RegExpExecArray | null;
  while ((match = iter.exec(normalized)) !== null) {
    const block = match[1];
    const valorRaw = tag(block, "TRNAMT");
    const dt = parseOfxDate(tag(block, "DTPOSTED"));
    if (!dt || !valorRaw) continue;
    const valor = Number(valorRaw.replace(",", "."));
    if (!Number.isFinite(valor) || valor === 0) continue;
    linhas.push({
      fitid: tag(block, "FITID") ?? null,
      data_movimento: dt,
      valor,
      descricao: tag(block, "MEMO") ?? tag(block, "NAME") ?? tag(block, "TRNTYPE") ?? "",
      documento: tag(block, "CHECKNUM") ?? tag(block, "REFNUM") ?? null,
      contraparte_nome: tag(block, "NAME") ?? null,
    });
  }

  return {
    linhas,
    periodo_inicio: dtStart,
    periodo_fim: dtEnd,
    bank_id: bankId,
    account_id: acctId,
  };
}