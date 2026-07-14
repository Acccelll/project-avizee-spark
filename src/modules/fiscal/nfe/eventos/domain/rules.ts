/**
 * Regras oficiais de eventos NF-e (subset essencial). Sempre retornam
 * Result<true> para uso no início dos use cases.
 */
import type { Result } from '../../../core/types';
import { ok, fail } from '../../../core/types';
import { makeError, FISCAL_ERROR_CODES } from '../../../core/errors';
import { TIPO_EVENTO } from './entities';
import type { EventoFiscal, InutilizacaoNumeracao } from './entities';

const fmt = (msg: string) => fail(makeError(FISCAL_ERROR_CODES.INTERNAL, msg));

export function validarEventoBase(ev: EventoFiscal): Result<true> {
  if (!/^\d{44}$/.test(ev.chaveAcesso)) return fmt('chave de acesso inválida (44 dígitos)');
  if (ev.nSeqEvento < 1 || ev.nSeqEvento > 20) return fmt('nSeqEvento fora do intervalo 1..20');
  if (!/^\d{14}$/.test(ev.cnpjOrgao)) return fmt('CNPJ do órgão inválido');
  if (!ev.dhEvento) return fmt('dhEvento obrigatório');
  return ok(true as const);
}

export function validarCancelamento(ev: EventoFiscal, dhAutorizacao?: string): Result<true> {
  const base = validarEventoBase(ev);
  if (!base.ok) return base;
  if (ev.tipoEvento !== TIPO_EVENTO.CANCELAMENTO) return fmt('tipoEvento incorreto para cancelamento');
  if (ev.nSeqEvento !== 1) return fmt('cancelamento exige nSeqEvento=1');
  const just = String(ev.detEvento.xJust ?? '');
  if (just.length < 15 || just.length > 255) return fmt('justificativa de cancelamento deve ter 15..255 caracteres');
  if (!ev.detEvento.nProt) return fmt('protocolo de autorização é obrigatório para cancelamento');
  if (dhAutorizacao) {
    const diffMs = new Date(ev.dhEvento).getTime() - new Date(dhAutorizacao).getTime();
    const janelaMs = 24 * 60 * 60 * 1000;
    if (diffMs > janelaMs) return fmt('cancelamento fora da janela de 24h após autorização');
  }
  return ok(true as const);
}

export function validarCartaCorrecao(ev: EventoFiscal): Result<true> {
  const base = validarEventoBase(ev);
  if (!base.ok) return base;
  if (ev.tipoEvento !== TIPO_EVENTO.CARTA_CORRECAO) return fmt('tipoEvento incorreto para CC-e');
  const texto = String(ev.detEvento.xCorrecao ?? '');
  if (texto.length < 15 || texto.length > 1000) return fmt('xCorrecao deve ter 15..1000 caracteres');
  return ok(true as const);
}

export function validarManifestacao(ev: EventoFiscal): Result<true> {
  const base = validarEventoBase(ev);
  if (!base.ok) return base;
  const manif: string[] = [
    TIPO_EVENTO.MANIF_CIENCIA,
    TIPO_EVENTO.MANIF_CONFIRMACAO,
    TIPO_EVENTO.MANIF_DESCONHECIMENTO,
    TIPO_EVENTO.MANIF_NAO_REALIZADA,
  ];
  if (!manif.includes(ev.tipoEvento)) return fmt('tipoEvento não é uma manifestação do destinatário');
  if (ev.tipoEvento === TIPO_EVENTO.MANIF_NAO_REALIZADA) {
    const just = String(ev.detEvento.xJust ?? '');
    if (just.length < 15 || just.length > 255) return fmt('operação não realizada exige justificativa 15..255');
  }
  return ok(true as const);
}

export function validarInutilizacao(inu: InutilizacaoNumeracao): Result<true> {
  if (!/^\d{14}$/.test(inu.cnpj)) return fmt('CNPJ inválido');
  if (inu.serie < 0 || inu.serie > 999) return fmt('série fora do intervalo');
  if (inu.nNFIni <= 0 || inu.nNFFin < inu.nNFIni) return fmt('faixa de numeração inválida');
  if ((inu.nNFFin - inu.nNFIni) > 9999) return fmt('faixa excede 10.000 números');
  if (inu.justificativa.length < 15 || inu.justificativa.length > 255) {
    return fmt('justificativa deve ter 15..255 caracteres');
  }
  return ok(true as const);
}

/** ID do evento — 54 dígitos: 'ID' + tpEvento(6) + chave(44) + nSeqEvento(2). */
export function montarIdEvento(tp: string, chave: string, nSeq: number): string {
  return `ID${tp}${chave}${String(nSeq).padStart(2, '0')}`;
}

/** ID de inutilização — 43 dígitos: 'ID' + cUF(2) + ano(2) + CNPJ(14) + mod(2) + serie(3) + nNFIni(9) + nNFFin(9). */
export function montarIdInutilizacao(cUF: string, inu: InutilizacaoNumeracao): string {
  return (
    'ID' +
    cUF.padStart(2, '0') +
    String(inu.ano).padStart(2, '0') +
    inu.cnpj.padStart(14, '0') +
    '55' +
    String(inu.serie).padStart(3, '0') +
    String(inu.nNFIni).padStart(9, '0') +
    String(inu.nNFFin).padStart(9, '0')
  );
}