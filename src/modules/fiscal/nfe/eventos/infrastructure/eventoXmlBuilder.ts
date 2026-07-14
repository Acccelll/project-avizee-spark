/**
 * Builder do XML de evento NF-e (envEvento v1.00) — subset essencial que
 * cobre cancelamento, CC-e e manifestação do destinatário. A assinatura
 * é aplicada sobre o elemento `infEvento` server-side.
 */
import { buildXml, withProlog, type XmlNode } from '../../../infrastructure/xml/xmlEngine';
import { montarIdEvento } from '../domain/rules';
import type { EventoFiscal } from '../domain/entities';

const NS = 'http://www.portalfiscal.inf.br/nfe';
const VERSAO = '1.00';

function n(name: string, value: string | number | undefined): XmlNode | null {
  if (value === undefined || value === null || value === '') return null;
  return { name, children: [String(value)] };
}

function filtered(children: Array<XmlNode | null>): XmlNode[] {
  return children.filter((c): c is XmlNode => c !== null);
}

function detEventoNode(ev: EventoFiscal): XmlNode {
  const children: XmlNode[] = filtered([
    n('descEvento', descricaoPadrao(ev.tipoEvento)),
    ...Object.entries(ev.detEvento).map(([k, v]) => n(k, v as string | number)),
  ]);
  return { name: 'detEvento', attrs: { versao: VERSAO }, children };
}

function descricaoPadrao(tp: string): string {
  switch (tp) {
    case '110111': return 'Cancelamento';
    case '110110': return 'Carta de Correcao';
    case '210210': return 'Ciencia da Operacao';
    case '210200': return 'Confirmacao da Operacao';
    case '210220': return 'Desconhecimento da Operacao';
    case '210240': return 'Operacao nao Realizada';
    default: return 'Evento';
  }
}

export function buildEventoXml(
  ev: EventoFiscal,
  ctx: { cOrgao: string; ambiente: 1 | 2 },
): { xml: string; id: string } {
  const id = montarIdEvento(ev.tipoEvento, ev.chaveAcesso, ev.nSeqEvento);
  const infEvento: XmlNode = {
    name: 'infEvento',
    attrs: { Id: id },
    children: filtered([
      n('cOrgao', ctx.cOrgao),
      n('tpAmb', ctx.ambiente),
      n('CNPJ', ev.cnpjOrgao),
      n('chNFe', ev.chaveAcesso),
      n('dhEvento', ev.dhEvento),
      n('tpEvento', ev.tipoEvento),
      n('nSeqEvento', ev.nSeqEvento),
      n('verEvento', VERSAO),
      detEventoNode(ev),
    ]),
  };
  const evento: XmlNode = {
    name: 'evento',
    attrs: { xmlns: NS, versao: VERSAO },
    children: [infEvento],
  };
  return { xml: withProlog(buildXml(evento)), id };
}

/** Envelope envEvento (lote com N eventos já assinados). */
export function buildEnvEvento(eventosAssinadosXml: string[], idLote = '1'): string {
  const body = eventosAssinadosXml
    .map((x) => x.replace(/^<\?xml[^?]*\?>/, ''))
    .join('');
  return withProlog(
    `<envEvento xmlns="${NS}" versao="${VERSAO}"><idLote>${idLote}</idLote>${body}</envEvento>`,
  );
}