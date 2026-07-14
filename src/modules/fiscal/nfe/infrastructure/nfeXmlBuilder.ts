/**
 * Builder do XML da NF-e (layout 4.00) — subset essencial.
 *
 * Reutiliza `buildXml`/`withProlog` do XML Engine. A ordem dos elementos
 * segue o layout oficial: <ide><emit><dest><det><total><transp>... A
 * canonicalização e a assinatura (`<Signature>` como irmão do `<infNFe>`)
 * são responsabilidade do SignatureEngine server-side.
 */
import { buildXml, withProlog, type XmlNode } from '../../infrastructure/xml/xmlEngine';
import { montarChave } from '../domain/rules';
import type { NFe, NFeItem, NFeIde } from '../domain/entities';

const NS = 'http://www.portalfiscal.inf.br/nfe';
const VERSAO = '4.00';

function n(name: string, value: string | number | undefined): XmlNode | null {
  if (value === undefined || value === null || value === '') return null;
  return { name, children: [String(value)] };
}

function filtered(children: Array<XmlNode | null>): XmlNode[] {
  return children.filter((c): c is XmlNode => c !== null);
}

function money(v: number): string { return v.toFixed(2); }
function qty(v: number): string { return v.toFixed(4); }

function ideNode(ide: NFeIde, chave: string): XmlNode {
  return {
    name: 'ide',
    children: filtered([
      n('cUF', ide.cUF),
      n('cNF', ide.cNF),
      n('natOp', ide.natOp),
      n('mod', '55'),
      n('serie', ide.serie),
      n('nNF', ide.nNF),
      n('dhEmi', ide.dhEmi),
      n('tpNF', ide.tpNF),
      n('idDest', ide.idDest),
      n('cMunFG', ide.cMunFG),
      n('tpImp', ide.tpImp),
      n('tpEmis', ide.tpEmis),
      n('cDV', chave.slice(-1)),
      n('tpAmb', ide.ambiente),
      n('finNFe', ide.finNFe),
      n('indFinal', ide.indFinal),
      n('indPres', ide.indPres),
      n('procEmi', '0'),
      n('verProc', 'AVIZEE-1.0'),
    ]),
  };
}

function detNode(item: NFeItem): XmlNode {
  return {
    name: 'det',
    attrs: { nItem: item.nItem },
    children: [
      {
        name: 'prod',
        children: filtered([
          n('cProd', item.cProd),
          n('cEAN', item.cEAN ?? 'SEM GTIN'),
          n('xProd', item.xProd),
          n('NCM', item.ncm),
          n('CFOP', item.cfop),
          n('uCom', item.uCom),
          n('qCom', qty(item.qCom)),
          n('vUnCom', money(item.vUnCom)),
          n('vProd', money(item.vProd)),
          n('cEANTrib', item.cEAN ?? 'SEM GTIN'),
          n('uTrib', item.uCom),
          n('qTrib', qty(item.qCom)),
          n('vUnTrib', money(item.vUnCom)),
          n('indTot', 1),
        ]),
      },
      {
        name: 'imposto',
        children: [
          {
            name: 'ICMS',
            children: [
              {
                name: `ICMS${item.cstIcms}`,
                children: filtered([n('orig', item.origem), n('CST', item.cstIcms)]),
              },
            ],
          },
        ],
      },
    ],
  };
}

export function buildNFeXml(nfe: NFe): { xml: string; chave: string } {
  const chave = montarChave(nfe);
  const infNFe: XmlNode = {
    name: 'infNFe',
    attrs: { Id: `NFe${chave}`, versao: VERSAO },
    children: [
      ideNode(nfe.ide, chave),
      {
        name: 'emit',
        children: filtered([
          n('CNPJ', nfe.emitente.cnpj),
          n('xNome', nfe.emitente.xNome),
          {
            name: 'enderEmit',
            children: filtered([
              n('xLgr', nfe.emitente.logradouro),
              n('nro', nfe.emitente.numero),
              n('xBairro', nfe.emitente.bairro),
              n('cMun', nfe.emitente.municipioIbge),
              n('xMun', ''),
              n('UF', nfe.emitente.uf),
              n('CEP', nfe.emitente.cep.replace(/\D/g, '')),
              n('cPais', '1058'),
              n('xPais', 'Brasil'),
            ]),
          },
          n('IE', nfe.emitente.ie),
          n('CRT', nfe.emitente.crt),
        ]),
      },
      {
        name: 'dest',
        children: filtered([
          nfe.destinatario.cnpjOuCpf.length === 14
            ? n('CNPJ', nfe.destinatario.cnpjOuCpf)
            : n('CPF', nfe.destinatario.cnpjOuCpf),
          n('xNome', nfe.destinatario.xNome),
          {
            name: 'enderDest',
            children: filtered([
              n('xLgr', nfe.destinatario.logradouro),
              n('nro', nfe.destinatario.numero),
              n('xBairro', nfe.destinatario.bairro),
              n('cMun', nfe.destinatario.municipioIbge),
              n('xMun', ''),
              n('UF', nfe.destinatario.uf),
              n('CEP', nfe.destinatario.cep.replace(/\D/g, '')),
              n('cPais', '1058'),
              n('xPais', 'Brasil'),
            ]),
          },
          n('indIEDest', nfe.destinatario.indIEDest),
          n('IE', nfe.destinatario.ie),
          n('email', nfe.destinatario.email),
        ]),
      },
      ...nfe.itens.map(detNode),
      {
        name: 'total',
        children: [
          {
            name: 'ICMSTot',
            children: filtered([
              n('vBC', money(nfe.totais.vBC)),
              n('vICMS', money(nfe.totais.vICMS)),
              n('vICMSDeson', '0.00'),
              n('vFCP', '0.00'),
              n('vBCST', '0.00'),
              n('vST', '0.00'),
              n('vProd', money(nfe.totais.vProd)),
              n('vFrete', money(nfe.totais.vFrete)),
              n('vSeg', money(nfe.totais.vSeg)),
              n('vDesc', money(nfe.totais.vDesc)),
              n('vII', '0.00'),
              n('vIPI', '0.00'),
              n('vPIS', '0.00'),
              n('vCOFINS', '0.00'),
              n('vOutro', '0.00'),
              n('vNF', money(nfe.totais.vNF)),
            ]),
          },
        ],
      },
      { name: 'transp', children: [{ name: 'modFrete', children: ['9'] }] },
      ...(nfe.infAdic
        ? [{ name: 'infAdic', children: [{ name: 'infCpl', children: [nfe.infAdic] }] } as XmlNode]
        : []),
    ],
  };
  const nfeNode: XmlNode = {
    name: 'NFe',
    attrs: { xmlns: NS },
    children: [infNFe],
  };
  return { xml: withProlog(buildXml(nfeNode)), chave };
}

/** Envelope enviNFe (lote síncrono, idLote=1 por padrão). */
export function buildEnviNFe(nfeAssinadoXml: string, idLote = '1'): string {
  // O XML assinado já vem serializado; concatenamos como fragmento.
  return withProlog(
    `<enviNFe xmlns="${NS}" versao="${VERSAO}">` +
      `<idLote>${idLote}</idLote>` +
      `<indSinc>1</indSinc>` +
      nfeAssinadoXml.replace(/^<\?xml[^?]*\?>/, '') +
      `</enviNFe>`,
  );
}