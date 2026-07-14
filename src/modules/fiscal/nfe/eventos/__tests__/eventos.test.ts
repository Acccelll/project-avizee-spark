import { describe, it, expect } from 'vitest';
import {
  TIPO_EVENTO,
  validarCancelamento,
  validarCartaCorrecao,
  validarInutilizacao,
  validarManifestacao,
  montarIdEvento,
  montarIdInutilizacao,
  buildEventoXml,
  buildEnvEvento,
  buildInutilizacaoXml,
  buildDistDFeXml,
} from '../index';
import type { EventoFiscal, InutilizacaoNumeracao } from '../domain/entities';
import { canTransition } from '../../domain/stateMachine';
import { parseXml, textOf } from '../../../infrastructure/xml/xmlEngine';

const CHAVE = '3'.repeat(44);

function eventoBase(over: Partial<EventoFiscal> = {}): EventoFiscal {
  return {
    id: 'ev-1', empresaId: 'emp-1', chaveAcesso: CHAVE,
    tipoEvento: TIPO_EVENTO.CANCELAMENTO, nSeqEvento: 1,
    cnpjOrgao: '12345678000199',
    dhEvento: '2026-07-14T12:00:00-03:00',
    detEvento: { nProt: '135260000000001', xJust: 'cancelamento por erro de digitacao no cliente' },
    status: 'pendente', correlationId: 'corr-1',
    ...over,
  };
}

describe('Eventos NF-e — regras', () => {
  it('aceita cancelamento válido dentro da janela de 24h', () => {
    const r = validarCancelamento(eventoBase(), '2026-07-14T10:00:00-03:00');
    expect(r.ok).toBe(true);
  });

  it('rejeita cancelamento fora da janela de 24h', () => {
    const r = validarCancelamento(eventoBase(), '2026-07-10T10:00:00-03:00');
    expect(r.ok).toBe(false);
  });

  it('rejeita justificativa curta no cancelamento', () => {
    const r = validarCancelamento(eventoBase({ detEvento: { nProt: '1', xJust: 'curto' } }));
    expect(r.ok).toBe(false);
  });

  it('valida CC-e com xCorrecao 15..1000 caracteres', () => {
    const ok = validarCartaCorrecao(eventoBase({
      tipoEvento: TIPO_EVENTO.CARTA_CORRECAO, nSeqEvento: 1,
      detEvento: { xCorrecao: 'a'.repeat(30) },
    }));
    expect(ok.ok).toBe(true);
    const bad = validarCartaCorrecao(eventoBase({
      tipoEvento: TIPO_EVENTO.CARTA_CORRECAO, detEvento: { xCorrecao: 'curto' },
    }));
    expect(bad.ok).toBe(false);
  });

  it('valida manifestação e exige justificativa para não realizada', () => {
    expect(validarManifestacao(eventoBase({ tipoEvento: TIPO_EVENTO.MANIF_CIENCIA, detEvento: {} })).ok).toBe(true);
    const r = validarManifestacao(eventoBase({
      tipoEvento: TIPO_EVENTO.MANIF_NAO_REALIZADA, detEvento: {},
    }));
    expect(r.ok).toBe(false);
  });

  it('valida faixa de inutilização', () => {
    const inu: InutilizacaoNumeracao = {
      id: 'i-1', empresaId: 'emp-1', ano: 26, cnpj: '12345678000199', serie: 1,
      nNFIni: 100, nNFFin: 110, justificativa: 'erro sequencial na emissao integrada',
      uf: 'SP', ambiente: 2, status: 'pendente', correlationId: 'c-1',
    };
    expect(validarInutilizacao(inu).ok).toBe(true);
    inu.nNFFin = 50;
    expect(validarInutilizacao(inu).ok).toBe(false);
  });
});

describe('Eventos NF-e — IDs', () => {
  it('ID de evento tem 54 dígitos (ID + 6 + 44 + 2)', () => {
    const id = montarIdEvento(TIPO_EVENTO.CANCELAMENTO, CHAVE, 1);
    expect(id.startsWith('ID')).toBe(true);
    expect(id.length).toBe(2 + 6 + 44 + 2);
  });

  it('ID de inutilização tem 43 dígitos após "ID"', () => {
    const inu: InutilizacaoNumeracao = {
      id: 'i-1', empresaId: 'e', ano: 26, cnpj: '12345678000199', serie: 1,
      nNFIni: 1, nNFFin: 10, justificativa: 'x'.repeat(20),
      uf: 'SP', ambiente: 2, status: 'pendente', correlationId: 'c',
    };
    const id = montarIdInutilizacao('35', inu);
    expect(id.startsWith('ID')).toBe(true);
    expect(id.length).toBe(2 + 2 + 2 + 14 + 2 + 3 + 9 + 9);
  });
});

describe('Eventos NF-e — builders XML', () => {
  it('gera evento com raiz <evento> e Id correto', () => {
    const { xml, id } = buildEventoXml(eventoBase(), { cOrgao: '35', ambiente: 2 });
    const doc = parseXml(xml);
    expect(doc.ok).toBe(true);
    const inf = doc.data!.getElementsByTagName('infEvento')[0];
    expect(inf.getAttribute('Id')).toBe(id);
    expect(textOf(doc.data!, 'tpEvento')).toBe(TIPO_EVENTO.CANCELAMENTO);
  });

  it('envelope envEvento concatena eventos assinados', () => {
    const { xml } = buildEventoXml(eventoBase(), { cOrgao: '35', ambiente: 2 });
    const env = buildEnvEvento([xml]);
    expect(env).toContain('<envEvento');
    expect(env).toContain('<idLote>1</idLote>');
    expect(env).toContain('<infEvento');
  });

  it('gera inutilização com Id de 43 dígitos', () => {
    const inu: InutilizacaoNumeracao = {
      id: 'i-1', empresaId: 'e', ano: 26, cnpj: '12345678000199', serie: 1,
      nNFIni: 1, nNFFin: 10, justificativa: 'x'.repeat(20),
      uf: 'SP', ambiente: 2, status: 'pendente', correlationId: 'c',
    };
    const { xml, id } = buildInutilizacaoXml(inu, { cUF: '35' });
    const doc = parseXml(xml);
    expect(doc.ok).toBe(true);
    expect(doc.data!.getElementsByTagName('infInut')[0].getAttribute('Id')).toBe(id);
  });

  it('gera distDFeInt com filtro ultNSU normalizado a 15 dígitos', () => {
    const xml = buildDistDFeXml({
      cnpj: '12345678000199', cUF: '35', ambiente: 2,
      filter: { modo: 'ultNSU', ultNSU: '123' },
    });
    expect(xml).toContain('<ultNSU>000000000000123</ultNSU>');
    expect(xml).toContain('<distDFeInt');
  });
});

describe('Máquina de estados — Etapa 7', () => {
  it('permite rascunho → inutilizada', () => {
    expect(canTransition('rascunho', 'inutilizada')).toBe(true);
  });
  it('permite autorizada → cancelada', () => {
    expect(canTransition('autorizada', 'cancelada')).toBe(true);
  });
  it('bloqueia autorizada → rascunho', () => {
    expect(canTransition('autorizada', 'rascunho')).toBe(false);
  });
});