/**
 * Parser universal de documentos fiscais eletrônicos.
 *
 * Objetivo: identificar o tipo documental a partir do XML e extrair um
 * conjunto mínimo comum de metadados (chave, emitente, destinatário, ide,
 * total). Baseado em `parseXml`/`textOf` do XML Engine (client-safe).
 *
 * Extensível via `registerParser` — cada plugin declara a raiz que aceita
 * e a função de extração; a resolução é O(1) pelo nome da raiz.
 */
import { parseXml, textOf } from '../../../infrastructure/xml/xmlEngine';
import type { Result } from '../../../core/types';
import { ok, fail } from '../../../core/types';
import { makeError, FISCAL_ERROR_CODES } from '../../../core/errors';
import type { ParseResult, TipoDocumentoRecebido, ItemDocumento } from '../../domain/entities';

export interface DocumentParserPlugin {
  matchRoots: string[];
  parse(doc: Document): ParseResult;
}

const REGISTRY = new Map<string, DocumentParserPlugin>();

export function registerParser(plugin: DocumentParserPlugin): void {
  for (const r of plugin.matchRoots) REGISTRY.set(r.toLowerCase(), plugin);
}

export function parseUniversal(xml: string): Result<ParseResult> {
  const doc = parseXml(xml);
  if (!doc.ok) return fail(doc.error!);
  const rootName = doc.data!.documentElement.localName.toLowerCase();
  const plugin = REGISTRY.get(rootName);
  if (!plugin) {
    return fail(makeError(
      FISCAL_ERROR_CODES.XML_PARSE,
      `nenhum parser registrado para raiz <${rootName}>`,
    ));
  }
  try {
    return ok(plugin.parse(doc.data!));
  } catch (e) {
    return fail(makeError(FISCAL_ERROR_CODES.XML_PARSE, String(e), e));
  }
}

function num(t: string | null | undefined): number | undefined {
  if (t === null || t === undefined || t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function extrairItensNFe(doc: Document): ItemDocumento[] {
  const dets = doc.getElementsByTagName('det');
  const itens: ItemDocumento[] = [];
  for (let i = 0; i < dets.length; i++) {
    const el = dets[i];
    const nItem = Number(el.getAttribute('nItem') ?? '0');
    const prod = el.getElementsByTagName('prod')[0];
    if (!prod) continue;
    itens.push({
      nItem,
      cProd: textOf(prod, 'cProd') ?? '',
      cEAN: textOf(prod, 'cEAN') ?? undefined,
      xProd: textOf(prod, 'xProd') ?? '',
      ncm: textOf(prod, 'NCM') ?? undefined,
      cfop: textOf(prod, 'CFOP') ?? undefined,
      uCom: textOf(prod, 'uCom') ?? '',
      qCom: num(textOf(prod, 'qCom')) ?? 0,
      vUnCom: num(textOf(prod, 'vUnCom')) ?? 0,
      vProd: num(textOf(prod, 'vProd')) ?? 0,
    });
  }
  return itens;
}

function parseNFeLike(doc: Document, tipo: TipoDocumentoRecebido): ParseResult {
  const infNFe = doc.getElementsByTagName('infNFe')[0];
  const chave = infNFe?.getAttribute('Id')?.replace(/^NFe/, '');
  const emit = doc.getElementsByTagName('emit')[0];
  const dest = doc.getElementsByTagName('dest')[0];
  const ide = doc.getElementsByTagName('ide')[0];
  const total = doc.getElementsByTagName('ICMSTot')[0];
  const infProt = doc.getElementsByTagName('infProt')[0];
  return {
    tipo,
    chaveAcesso: chave || textOf(infProt ?? doc, 'chNFe') || undefined,
    numeroDoc: textOf(ide ?? doc, 'nNF') ?? undefined,
    serieDoc: textOf(ide ?? doc, 'serie') ?? undefined,
    cnpjEmit: textOf(emit ?? doc, 'CNPJ') ?? undefined,
    cnpjDest: dest ? textOf(dest, 'CNPJ') ?? textOf(dest, 'CPF') ?? undefined : undefined,
    ufEmit: emit ? textOf(emit, 'UF') ?? undefined : undefined,
    ufDest: dest ? textOf(dest, 'UF') ?? undefined : undefined,
    dhEmi: textOf(ide ?? doc, 'dhEmi') ?? undefined,
    vTotal: total ? num(textOf(total, 'vNF')) : undefined,
    protocoloAutorizacao: textOf(infProt ?? doc, 'nProt') ?? undefined,
    itens: extrairItensNFe(doc),
  };
}

// -------- plugins built-in ---------------------------------------------

registerParser({
  matchRoots: ['nfeproc'],
  parse: (doc) => parseNFeLike(doc, 'NFe'),
});

registerParser({
  matchRoots: ['nfe'],
  parse: (doc) => {
    // NFC-e reutiliza o mesmo layout; diferenciação por mod=65
    const mod = textOf(doc, 'mod');
    return parseNFeLike(doc, mod === '65' ? 'NFCe' : 'NFe');
  },
});

registerParser({
  matchRoots: ['procevento', 'proceventonfe', 'evento'],
  parse: (doc) => ({
    tipo: 'EventoNFe',
    chaveAcesso: textOf(doc, 'chNFe') ?? undefined,
    numeroDoc: textOf(doc, 'tpEvento') ?? undefined,
    protocoloAutorizacao: textOf(doc, 'nProt') ?? undefined,
    cnpjEmit: textOf(doc, 'CNPJ') ?? undefined,
  }),
});

registerParser({
  matchRoots: ['cteproc', 'cte'],
  parse: (doc) => {
    const infCte = doc.getElementsByTagName('infCte')[0];
    return {
      tipo: 'CTe',
      chaveAcesso: infCte?.getAttribute('Id')?.replace(/^CTe/, '') ?? textOf(doc, 'chCTe') ?? undefined,
      numeroDoc: textOf(doc, 'nCT') ?? undefined,
      serieDoc: textOf(doc, 'serie') ?? undefined,
      cnpjEmit: textOf(doc, 'CNPJ') ?? undefined,
      protocoloAutorizacao: textOf(doc, 'nProt') ?? undefined,
      vTotal: num(textOf(doc, 'vTPrest')),
    };
  },
});

registerParser({
  matchRoots: ['mdfeproc', 'mdfe'],
  parse: (doc) => {
    const infMdfe = doc.getElementsByTagName('infMDFe')[0];
    return {
      tipo: 'MDFe',
      chaveAcesso: infMdfe?.getAttribute('Id')?.replace(/^MDFe/, '') ?? undefined,
      numeroDoc: textOf(doc, 'nMDF') ?? undefined,
      cnpjEmit: textOf(doc, 'CNPJ') ?? undefined,
      protocoloAutorizacao: textOf(doc, 'nProt') ?? undefined,
    };
  },
});

registerParser({
  matchRoots: ['compnfse', 'nfse', 'consultanfseresposta'],
  parse: (doc) => ({
    tipo: 'NFSe',
    numeroDoc: textOf(doc, 'Numero') ?? textOf(doc, 'numero') ?? undefined,
    cnpjEmit: textOf(doc, 'Cnpj') ?? undefined,
    vTotal: num(textOf(doc, 'ValorServicos')) ?? num(textOf(doc, 'ValorLiquidoNfse')),
  }),
});

registerParser({
  matchRoots: ['retconssitnfe', 'retconsstatserv', 'retenvievento', 'retinutnfe'],
  parse: () => ({ tipo: 'ProtocoloNFe' }),
});