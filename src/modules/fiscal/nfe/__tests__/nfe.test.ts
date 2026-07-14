import { describe, it, expect } from 'vitest';
import { calcularDvChave, montarChave, validarNFe } from '../domain/rules';
import { canTransition, transition } from '../domain/stateMachine';
import { buildNFeXml } from '../infrastructure/nfeXmlBuilder';
import type { NFe } from '../domain/entities';
import { parseXml, textOf } from '../../infrastructure/xml/xmlEngine';

function nfeMock(overrides: Partial<NFe> = {}): NFe {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    empresaId: 'emp-1',
    status: 'rascunho',
    correlationId: 'corr-1',
    ide: {
      cUF: '35', natOp: 'Venda', serie: 1, nNF: 1,
      dhEmi: '2026-07-14T12:00:00-03:00',
      tpNF: 1, idDest: 1, cMunFG: '3550308', tpImp: 1, tpEmis: 1,
      finNFe: 1, indFinal: 1, indPres: 1, ambiente: 2, cNF: '12345678',
    },
    emitente: {
      cnpj: '12345678000199', xNome: 'AVIZEE LTDA', ie: '1234567890',
      crt: 3, uf: 'SP', municipioIbge: '3550308',
      logradouro: 'Rua A', numero: '10', bairro: 'Centro', cep: '01000000',
    },
    destinatario: {
      cnpjOuCpf: '98765432000188', xNome: 'CLIENTE X',
      indIEDest: 9, uf: 'SP', municipioIbge: '3550308',
      logradouro: 'Av B', numero: '20', bairro: 'Centro', cep: '02000000',
    },
    itens: [{
      nItem: 1, cProd: 'P1', xProd: 'PROD 1', ncm: '61099000',
      cfop: '5102', uCom: 'UN', qCom: 1, vUnCom: 100, vProd: 100,
      cstIcms: '00', origem: 0,
    }],
    totais: { vBC: 0, vICMS: 0, vProd: 100, vFrete: 0, vSeg: 0, vDesc: 0, vNF: 100 },
    ...overrides,
  } as NFe;
}

describe('NF-e — regras de negócio', () => {
  it('aceita NF-e mínima consistente', () => {
    const r = validarNFe(nfeMock());
    expect(r.ok).toBe(true);
  });

  it('rejeita vNF inconsistente', () => {
    const nfe = nfeMock();
    nfe.totais.vNF = 999;
    const r = validarNFe(nfe);
    expect(r.ok).toBe(false);
  });

  it('rejeita idDest=1 quando UF emit != dest', () => {
    const nfe = nfeMock();
    nfe.destinatario.uf = 'RJ';
    const r = validarNFe(nfe);
    expect(r.ok).toBe(false);
  });
});

describe('NF-e — chave de acesso', () => {
  it('DV é dígito único (0..9)', () => {
    const dv = calcularDvChave('3'.repeat(43));
    expect(dv).toMatch(/^\d$/);
  });

  it('chave tem 44 dígitos', () => {
    const chave = montarChave(nfeMock());
    expect(chave).toHaveLength(44);
    expect(chave).toMatch(/^\d{44}$/);
  });
});

describe('NF-e — máquina de estados', () => {
  it('rascunho → validada → assinada → autorizada', () => {
    expect(canTransition('rascunho', 'validada')).toBe(true);
    expect(canTransition('validada', 'assinada')).toBe(true);
    expect(canTransition('transmitida', 'autorizada')).toBe(true);
  });

  it('rejeita autorizada → validada', () => {
    const r = transition('autorizada', 'validada');
    expect(r.ok).toBe(false);
  });
});

describe('NF-e — builder XML', () => {
  it('gera XML com raiz <NFe> e Id NFe<chave>', () => {
    const { xml, chave } = buildNFeXml(nfeMock());
    const doc = parseXml(xml);
    expect(doc.ok).toBe(true);
    expect(doc.data!.documentElement.localName).toBe('NFe');
    const infNFe = doc.data!.getElementsByTagName('infNFe')[0];
    expect(infNFe.getAttribute('Id')).toBe(`NFe${chave}`);
    expect(infNFe.getAttribute('versao')).toBe('4.00');
    expect(textOf(doc.data!, 'CNPJ')).toBe('12345678000199');
  });
});