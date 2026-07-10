export interface OFXTransaction {
  id: string;
  data: string;
  valor: number;
  descricao: string;
  /** Campos crus adicionais preservados para enriquecimento canônico (Fase 1 do Motor Inteligente). */
  trntype?: string;
  name?: string;
  checknum?: string;
  refnum?: string;
  memo?: string;
}

const ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

/**
 * Parses an OFX/QFX file (semi-XML format) and extracts transactions.
 * Returns an array of { id, data, valor, descricao }.
 */
export function parseOFX(text: string): OFXTransaction[] {
  const normalized = normalizeOFXText(text);
  const blocks = extractBlocks(normalized, "STMTTRN");

  return dedupeTransactions(
    blocks.map((block, index) => parseTransaction(block, index)),
  );
}

/** Lê arquivos OFX/QFX preservando acentuação comum em bancos brasileiros. */
export async function readOFXFileText(file: File): Promise<string> {
  if (!file.arrayBuffer) {
    return file.text();
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const probe = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 4096));
  const encoding = detectOFXEncoding(probe);

  try {
    return new TextDecoder(encoding, { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
}

/** Lê e faz parse de um arquivo OFX/QFX preservando o sinal original do valor. */
export async function parseOFXFile(file: File): Promise<OFXTransaction[]> {
  return parseOFX(await readOFXFileText(file));
}

function parseTransaction(block: string, index: number): OFXTransaction {
  const rawFitid = extractField(block, "FITID");
  const refnum = extractField(block, "REFNUM") || undefined;
  const checknum = extractField(block, "CHECKNUM") || undefined;
  const fitid = rawFitid || refnum || checknum;
  const dtposted = extractField(block, "DTPOSTED") || extractField(block, "DTAVAIL") || "";
  const trnamt = extractField(block, "TRNAMT") || "";
  const memoRaw = extractField(block, "MEMO") || undefined;
  const nameRaw = extractField(block, "NAME") || undefined;
  const trntype = extractField(block, "TRNTYPE") || undefined;
  const memo = memoRaw || nameRaw || trntype || "";

  if (!dtposted) {
    throw new Error(`Transação OFX inválida na posição ${index + 1}: campo DTPOSTED ausente.`);
  }
  if (!trnamt) {
    throw new Error(`Transação OFX inválida na posição ${index + 1}: campo TRNAMT ausente.`);
  }

  const data = parseOFXDate(dtposted, index);
  const valor = parseOFXAmount(trnamt, index);

  // Quando o banco não fornece FITID, gera um ID determinístico a partir
  // do conteúdo (data + valor + descrição) para evitar colisão de posição
  // em re-imports parciais (M-05).
  const id = fitid || `ofx-${djb2(`${data}|${valor}|${memo.trim()}`).toString(16)}`;

  return {
    id,
    data,
    valor,
    descricao: memo.trim(),
    trntype,
    name: nameRaw,
    checknum,
    refnum,
    memo: memoRaw,
  };
}

/** Hash determinístico (djb2) — leve, sem dependências, suficiente para deduplicação local. */
function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return h >>> 0;
}

/** Extracts a field value from an OFX block (handles both XML and SGML formats) */
function extractField(block: string, field: string): string | null {
  const tag = `\\s*(?:[A-Z0-9_]+:)?${field}\\b[^>]*`;

  // XML format: <FIELD>value</FIELD>
  const xmlPattern = new RegExp(`<${tag}>([\\s\\S]*?)<\\/\\s*(?:[A-Z0-9_]+:)?${field}\\s*>`, "i");
  const xmlMatch = xmlPattern.exec(block);
  if (xmlMatch) return decodeOFXEntities(xmlMatch[1].trim());

  // SGML format: <FIELD>value\n (no closing tag)
  const sgmlPattern = new RegExp(`<${tag}>\\s*([^\\n<]*)`, "i");
  const sgmlMatch = sgmlPattern.exec(block);
  if (sgmlMatch) return decodeOFXEntities(sgmlMatch[1].trim());

  return null;
}

/**
 * Extracts aggregate blocks from XML and SGML OFX.
 * OFX v1 often omits closing tags for leaf fields, but aggregate STMTTRN tags
 * normally close. The fallback also handles malformed files where STMTTRN is
 * only delimited by the next STMTTRN/BANKTRANLIST marker.
 */
function extractBlocks(text: string, tag: string): string[] {
  const blocks: string[] = [];
  const open = `<\\s*(?:[A-Z0-9_]+:)?${tag}\\b[^>]*>`;
  const close = `<\\/\\s*(?:[A-Z0-9_]+:)?${tag}\\s*>`;
  const closedPattern = new RegExp(`${open}([\\s\\S]*?)${close}`, "gi");
  let match: RegExpExecArray | null;

  while ((match = closedPattern.exec(text)) !== null) {
    blocks.push(match[1]);
  }

  if (blocks.length > 0) return blocks;

  const openPattern = new RegExp(open, "gi");
  const starts: number[] = [];
  while ((match = openPattern.exec(text)) !== null) {
    starts.push(openPattern.lastIndex);
  }

  for (let i = 0; i < starts.length; i++) {
    const end = starts[i + 1] ?? findFirstIndex(text, starts[i], [
      /<\s*\/\s*(?:[A-Z0-9_]+:)?BANKTRANLIST\s*>/i,
      /<\s*\/\s*(?:[A-Z0-9_]+:)?STMTRS\s*>/i,
      /<\s*\/\s*(?:[A-Z0-9_]+:)?CCSTMTRS\s*>/i,
      /<\s*(?:[A-Z0-9_]+:)?LEDGERBAL\b[^>]*>/i,
    ]) ?? text.length;
    const block = text.slice(starts[i], end).trim();
    if (block) {
      blocks.push(block);
    }
  }

  return blocks;
}

/**
 * Converts OFX date string (YYYYMMDDHHMMSS or YYYYMMDD) to ISO date string (YYYY-MM-DD).
 */
function parseOFXDate(dtposted: string, index: number): string {
  // Remove timezone info if present (e.g., "20231015120000[-3:BRT]" -> "20231015")
  const cleaned = dtposted.replace(/\[.*\]/, "").replace(/\D/g, "").trim();
  if (cleaned.length < 8) {
    throw new Error(`Transação OFX inválida na posição ${index + 1}: data inválida (${dtposted}).`);
  }

  const year = cleaned.slice(0, 4);
  const month = cleaned.slice(4, 6);
  const day = cleaned.slice(6, 8);
  const iso = `${year}-${month}-${day}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() + 1 !== Number(month) ||
    parsed.getUTCDate() !== Number(day)
  ) {
    throw new Error(`Transação OFX inválida na posição ${index + 1}: data inválida (${dtposted}).`);
  }

  return iso;
}

function parseOFXAmount(raw: string, index: number): number {
  const normalized = raw.trim().replace(/\s/g, "");
  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  const decimalSeparator = lastComma > lastDot ? "," : ".";
  const thousandsSeparator = decimalSeparator === "," ? "." : ",";
  const sanitized = normalized
    .replace(new RegExp(`\\${thousandsSeparator}`, "g"), "")
    .replace(decimalSeparator, ".");
  const parsed = Number(sanitized);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Transação OFX inválida na posição ${index + 1}: valor inválido (${raw}).`);
  }

  return parsed;
}

function normalizeOFXText(text: string): string {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function detectOFXEncoding(probe: string): string {
  const charset = /(?:^|\n)\s*CHARSET\s*:\s*([^\n\r]+)/i.exec(probe)?.[1]?.trim().toLowerCase();
  const encoding = /(?:^|\n)\s*ENCODING\s*:\s*([^\n\r]+)/i.exec(probe)?.[1]?.trim().toLowerCase();
  const label = charset || encoding || "utf-8";

  if (label.includes("1252") || label.includes("ansi")) return "windows-1252";
  if (label.includes("8859") || label.includes("latin")) return "iso-8859-1";
  if (label.includes("utf")) return "utf-8";
  if (label.includes("usascii") || label.includes("ascii")) return "windows-1252";
  return "utf-8";
}

function decodeOFXEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, code: string) => {
    const lower = code.toLowerCase();
    if (lower.startsWith("#x")) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
    if (lower.startsWith("#")) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
    return ENTITY_MAP[lower] ?? entity;
  });
}

function findFirstIndex(text: string, start: number, patterns: RegExp[]): number | null {
  let first: number | null = null;
  const slice = text.slice(start);

  for (const pattern of patterns) {
    const match = pattern.exec(slice);
    if (!match) continue;
    const absoluteIndex = start + match.index;
    first = first === null ? absoluteIndex : Math.min(first, absoluteIndex);
  }

  return first;
}

function dedupeTransactions(transactions: OFXTransaction[]): OFXTransaction[] {
  const signaturesById = new Map<string, Set<string>>();
  const result: OFXTransaction[] = [];

  for (const transaction of transactions) {
    const signature = `${transaction.data}|${transaction.valor}|${transaction.descricao}`;
    const signatures = signaturesById.get(transaction.id) ?? new Set<string>();

    if (signatures.has(signature)) continue;

    const id = signatures.size === 0
      ? transaction.id
      : `${transaction.id}-${djb2(signature).toString(16)}`;

    signatures.add(signature);
    signaturesById.set(transaction.id, signatures);
    result.push({ ...transaction, id });
  }

  return result;
}