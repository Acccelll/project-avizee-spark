/**
 * Validações de recebimento — sobre o resultado do parser.
 * XSD estrutural leve delega para `ClientSideXsdValidator` (Etapa 5).
 * A conferência de assinatura digital fica server-side (sefaz-proxy).
 */
import type { Result } from '../../core/types';
import { ok, fail } from '../../core/types';
import { makeError, FISCAL_ERROR_CODES } from '../../core/errors';
import type { ParseResult } from './entities';

const fmt = (msg: string) => fail(makeError(FISCAL_ERROR_CODES.INTERNAL, msg));

export interface ValidacaoContexto {
  cnpjEmpresa: string;
  ambientePermitido?: 1 | 2;
  aceitaSemChave?: boolean;
}

export function validarDocumentoRecebido(
  parsed: ParseResult,
  ctx: ValidacaoContexto,
): Result<true> {
  if (parsed.tipo === 'Desconhecido') return fmt('tipo documental não identificado');
  const exigeChave = parsed.tipo === 'NFe' || parsed.tipo === 'NFCe'
    || parsed.tipo === 'CTe' || parsed.tipo === 'MDFe';
  if (exigeChave && !ctx.aceitaSemChave) {
    if (!parsed.chaveAcesso) return fmt('documento sem chave de acesso');
    if (!/^\d{44}$/.test(parsed.chaveAcesso)) return fmt('chave de acesso inválida');
  }
  if (parsed.cnpjDest && parsed.cnpjDest !== ctx.cnpjEmpresa && parsed.tipo === 'NFe') {
    // permitido para NFC-e/CT-e (tomador pode diferir), mas alertamos NF-e
    return fmt(`CNPJ destinatário (${parsed.cnpjDest}) diferente da empresa (${ctx.cnpjEmpresa})`);
  }
  if (parsed.vTotal !== undefined && parsed.vTotal < 0) return fmt('valor total negativo');
  if (parsed.itens) {
    for (const it of parsed.itens) {
      if (it.qCom <= 0) return fmt(`item ${it.nItem}: quantidade inválida`);
      if (it.vUnCom < 0) return fmt(`item ${it.nItem}: valor unitário negativo`);
    }
  }
  return ok(true as const);
}