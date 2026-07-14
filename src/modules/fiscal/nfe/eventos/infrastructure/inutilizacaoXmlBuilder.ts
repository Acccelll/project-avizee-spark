/**
 * Builder do XML de inutilização de numeração (inutNFe v4.00).
 */
import { buildXml, withProlog, type XmlNode } from '../../../infrastructure/xml/xmlEngine';
import { montarIdInutilizacao } from '../domain/rules';
import type { InutilizacaoNumeracao } from '../domain/entities';

const NS = 'http://www.portalfiscal.inf.br/nfe';
const VERSAO = '4.00';

function n(name: string, value: string | number): XmlNode {
  return { name, children: [String(value)] };
}

export function buildInutilizacaoXml(
  inu: InutilizacaoNumeracao,
  ctx: { cUF: string },
): { xml: string; id: string } {
  const id = montarIdInutilizacao(ctx.cUF, inu);
  const infInut: XmlNode = {
    name: 'infInut',
    attrs: { Id: id, versao: VERSAO },
    children: [
      n('tpAmb', inu.ambiente),
      n('xServ', 'INUTILIZAR'),
      n('cUF', ctx.cUF),
      n('ano', inu.ano),
      n('CNPJ', inu.cnpj),
      n('mod', '55'),
      n('serie', inu.serie),
      n('nNFIni', inu.nNFIni),
      n('nNFFin', inu.nNFFin),
      n('xJust', inu.justificativa),
    ],
  };
  const inutNFe: XmlNode = {
    name: 'inutNFe',
    attrs: { xmlns: NS, versao: VERSAO },
    children: [infInut],
  };
  return { xml: withProlog(buildXml(inutNFe)), id };
}