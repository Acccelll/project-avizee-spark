/**
 * Builder do XML de Distribuição DF-e (distDFeInt v1.35).
 * Aceita consulta por último NSU, por NSU específico ou por chave.
 */
import { withProlog } from '../../../infrastructure/xml/xmlEngine';

const NS = 'http://www.portalfiscal.inf.br/nfe';
const VERSAO = '1.35';

export type DistDFeMode =
  | { modo: 'ultNSU'; ultNSU: string }
  | { modo: 'nsu'; nsu: string }
  | { modo: 'chave'; chave: string };

export function buildDistDFeXml(input: {
  cnpj: string;
  cUF: string;
  ambiente: 1 | 2;
  filter: DistDFeMode;
}): string {
  const cabec =
    `<tpAmb>${input.ambiente}</tpAmb>` +
    `<cUFAutor>${input.cUF}</cUFAutor>` +
    `<CNPJ>${input.cnpj}</CNPJ>`;
  let filtro = '';
  if (input.filter.modo === 'ultNSU') {
    filtro = `<distNSU><ultNSU>${input.filter.ultNSU.padStart(15, '0')}</ultNSU></distNSU>`;
  } else if (input.filter.modo === 'nsu') {
    filtro = `<consNSU><NSU>${input.filter.nsu.padStart(15, '0')}</NSU></consNSU>`;
  } else {
    filtro = `<consChNFe><chNFe>${input.filter.chave}</chNFe></consChNFe>`;
  }
  return withProlog(
    `<distDFeInt xmlns="${NS}" versao="${VERSAO}">${cabec}${filtro}</distDFeInt>`,
  );
}