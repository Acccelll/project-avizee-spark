/**
 * XML Engine — leitura, construção e serialização de XML.
 *
 * Client-safe: usa DOMParser/XMLSerializer nativos do browser. A
 * canonicalização C14N e a assinatura XMLDSig **não** vivem aqui: são
 * realizadas server-side pelo `sefaz-proxy` (ver `mem/tech/sefaz-mtls-transporte`
 * e `supabase/functions/_shared/pfx.ts`), porque o transporte mTLS
 * exige stack OpenSSL/Schannel.
 */
import { makeError, FISCAL_ERROR_CODES } from '../../core/errors';
import type { Result } from '../../core/types';
import { ok, fail } from '../../core/types';

export interface XmlNode {
  name: string;
  attrs?: Record<string, string | number | undefined>;
  children?: Array<XmlNode | string>;
}

function encodeXml(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Serializa um `XmlNode` em string XML. Ordem de atributos é preservada
 * (Map de inserção do Object), o que é suficiente para XSD; a
 * canonicalização C14N (que impõe ordem lexicográfica) fica server-side.
 */
export function buildXml(node: XmlNode): string {
  const attrs = node.attrs
    ? Object.entries(node.attrs)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => ` ${k}="${encodeXml(String(v))}"`)
        .join('')
    : '';
  if (!node.children || node.children.length === 0) return `<${node.name}${attrs}/>`;
  const body = node.children
    .map((c) => (typeof c === 'string' ? encodeXml(c) : buildXml(c)))
    .join('');
  return `<${node.name}${attrs}>${body}</${node.name}>`;
}

/**
 * Envolve o payload num prólogo XML padrão UTF-8 (encoding exigido pela SEFAZ).
 */
export function withProlog(xml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>${xml}`;
}

/**
 * Faz parse de XML e devolve o Document ou erro estruturado.
 * Funciona em browser (DOMParser) e no Node/vitest (jsdom).
 */
export function parseXml(xml: string): Result<Document> {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    // DOMParser sinaliza erro em <parsererror> em vez de throw.
    const err = doc.getElementsByTagName('parsererror')[0];
    if (err) {
      return fail(makeError(FISCAL_ERROR_CODES.XML_PARSE, err.textContent ?? 'parse error'));
    }
    return ok(doc);
  } catch (e) {
    return fail(makeError(FISCAL_ERROR_CODES.XML_PARSE, String(e), e));
  }
}

export function textOf(doc: Document | Element, tag: string): string | null {
  const el = doc.getElementsByTagName(tag)[0];
  return el?.textContent ?? null;
}