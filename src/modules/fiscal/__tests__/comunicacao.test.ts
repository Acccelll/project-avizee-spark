import { describe, it, expect } from 'vitest';
import { buildXml, parseXml, withProlog } from '../infrastructure/xml/xmlEngine';
import { ClientSideXsdValidator } from '../infrastructure/xml/xsdValidator';
import { CircuitBreaker } from '../infrastructure/transport/circuitBreaker';
import { withRetry } from '../infrastructure/transport/retryPolicy';
import { makeError, FISCAL_ERROR_CODES, isRetryable } from '../core/errors';
import { ok, fail } from '../core/types';

describe('XML Engine', () => {
  it('serializa nó com atributos e filhos e faz round-trip', () => {
    const xml = withProlog(
      buildXml({
        name: 'enviNFe',
        attrs: { xmlns: 'http://www.portalfiscal.inf.br/nfe', versao: '4.00' },
        children: [{ name: 'idLote', children: ['1'] }],
      }),
    );
    const parsed = parseXml(xml);
    expect(parsed.ok).toBe(true);
    expect(parsed.data!.documentElement.localName).toBe('enviNFe');
  });

  it('escapa caracteres especiais', () => {
    const xml = buildXml({ name: 'x', children: ['a & b < c'] });
    expect(xml).toContain('a &amp; b &lt; c');
  });
});

describe('XSD Validator (client-side)', () => {
  it('rejeita raiz incorreta', async () => {
    const v = new ClientSideXsdValidator();
    const r = await v.validate('<foo/>', { schemaRoot: 'x.xsd', rootElement: 'bar' });
    expect(r.ok).toBe(false);
    expect(r.error!.code).toBe(FISCAL_ERROR_CODES.XSD_INVALID);
  });
});

describe('CircuitBreaker', () => {
  it('abre após threshold e reabre em half-open', () => {
    const b = new CircuitBreaker({ threshold: 2, cooldownMs: 1 });
    b.reportFailure('k'); b.reportFailure('k');
    expect(b.stateOf('k')).toBe('open');
    expect(b.canPass('k', Date.now() + 10)).toBe(true);
    b.reportSuccess('k');
    expect(b.stateOf('k')).toBe('closed');
  });
});

describe('withRetry', () => {
  it('não retenta erros não-retryable', async () => {
    let calls = 0;
    const r = await withRetry(async () => {
      calls++;
      return fail(makeError(FISCAL_ERROR_CODES.SEFAZ_REJEICAO, 'rej'));
    }, { max: 3, backoffMs: [0, 0, 0] });
    expect(calls).toBe(1);
    expect(r.ok).toBe(false);
  });

  it('reenvia até sucesso quando retryable', async () => {
    let calls = 0;
    const r = await withRetry(async () => {
      calls++;
      if (calls < 2) return fail(makeError(FISCAL_ERROR_CODES.NETWORK_TIMEOUT, 'to'));
      return ok('ok');
    }, { max: 3, backoffMs: [0, 0, 0] });
    expect(calls).toBe(2);
    expect(r.ok).toBe(true);
  });
});

describe('errors', () => {
  it('flag retryable é derivada do código', () => {
    expect(isRetryable(makeError(FISCAL_ERROR_CODES.NETWORK_TIMEOUT, ''))).toBe(true);
    expect(isRetryable(makeError(FISCAL_ERROR_CODES.SEFAZ_REJEICAO, ''))).toBe(false);
  });
});