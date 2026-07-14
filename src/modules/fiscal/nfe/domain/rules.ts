/**
 * Regras de negócio essenciais para autorização de NF-e (subset).
 * Cada função retorna Result<true> ou FiscalError com código canônico.
 */
import type { NFe } from './entities';
import type { Result } from '../../core/types';
import { ok, fail } from '../../core/types';
import { makeError, FISCAL_ERROR_CODES } from '../../core/errors';

function fmt(msg: string) {
  return fail(makeError(FISCAL_ERROR_CODES.INTERNAL, msg));
}

export function validarNFe(nfe: NFe): Result<true> {
  if (!nfe.emitente.cnpj || nfe.emitente.cnpj.length !== 14) return fmt('CNPJ do emitente inválido');
  if (nfe.ide.serie < 0 || nfe.ide.serie > 999) return fmt('Série da NF-e fora do intervalo 0–999');
  if (nfe.ide.nNF <= 0) return fmt('Número da NF-e deve ser positivo');
  if (!/^\d{8}$/.test(nfe.ide.cNF)) return fmt('cNF deve conter 8 dígitos');
  if (nfe.ide.ambiente !== 1 && nfe.ide.ambiente !== 2) return fmt('Ambiente inválido');
  if (nfe.itens.length === 0) return fmt('NF-e sem itens');
  const somaProd = nfe.itens.reduce((s, i) => s + i.vProd, 0);
  if (Math.abs(somaProd - nfe.totais.vProd) > 0.01) return fmt('Total de produtos inconsistente');
  const vCalc = nfe.totais.vProd + nfe.totais.vFrete + nfe.totais.vSeg - nfe.totais.vDesc;
  if (Math.abs(vCalc - nfe.totais.vNF) > 0.01) return fmt('vNF inconsistente com composição');
  if (nfe.ide.idDest === 1 && nfe.emitente.uf !== nfe.destinatario.uf) {
    return fmt('idDest=1 (interna) exige UF emitente == UF destinatário');
  }
  if (nfe.destinatario.indIEDest === 1 && !nfe.destinatario.ie) {
    return fmt('indIEDest=1 exige IE do destinatário');
  }
  return ok(true as const);
}

/** DV mod 11 pela ordem regressiva 2..9 sobre os 43 primeiros dígitos. */
export function calcularDvChave(chaveSemDv: string): string {
  if (chaveSemDv.length !== 43) throw new Error('chave sem DV precisa ter 43 dígitos');
  const pesos = [2, 3, 4, 5, 6, 7, 8, 9];
  let soma = 0;
  for (let i = chaveSemDv.length - 1, p = 0; i >= 0; i--, p++) {
    soma += Number(chaveSemDv[i]) * pesos[p % pesos.length];
  }
  const resto = soma % 11;
  const dv = resto === 0 || resto === 1 ? 0 : 11 - resto;
  return String(dv);
}

/**
 * Monta chave de acesso NF-e 44 dígitos:
 * cUF(2) + AAMM(4) + CNPJ(14) + mod(2) + serie(3) + nNF(9) + tpEmis(1) + cNF(8) + cDV(1)
 */
export function montarChave(nfe: NFe): string {
  const dh = new Date(nfe.ide.dhEmi);
  const aamm = `${String(dh.getUTCFullYear()).slice(2)}${String(dh.getUTCMonth() + 1).padStart(2, '0')}`;
  const base =
    nfe.ide.cUF.padStart(2, '0') +
    aamm +
    nfe.emitente.cnpj.padStart(14, '0') +
    '55' +
    String(nfe.ide.serie).padStart(3, '0') +
    String(nfe.ide.nNF).padStart(9, '0') +
    String(nfe.ide.tpEmis) +
    nfe.ide.cNF;
  return base + calcularDvChave(base);
}