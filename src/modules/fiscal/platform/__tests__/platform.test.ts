import { describe, it, expect } from 'vitest';
import { FiscalPlatform, FDocPlugin, WorkflowExecutor } from '../index';
import { NFePlugin } from '../../nfe/plugin';

describe('Etapa 13 — Fiscal Platform (plugin architecture)', () => {
  it('registra plugin NF-e sem alterar comportamento existente', async () => {
    const p = new FiscalPlatform();
    await p.use(NFePlugin);
    expect(p.documentos.has('nfe')).toBe(true);
    expect(p.documentos.suportam('cancelamento').map((d) => d.codigo)).toContain('nfe');
    expect(p.layouts.listByDocumento('nfe').length).toBeGreaterThan(0);
    expect(p.eventos.get('fiscal.nfe.autorizada')?.categoria).toBe('fiscal');
  });

  it('coexistência: NF-e e documento fictício registrados juntos', async () => {
    const p = new FiscalPlatform();
    await p.discover([NFePlugin, FDocPlugin]);
    expect(p.documentos.list().map((d) => d.codigo).sort()).toEqual(['fdoc', 'nfe']);
    expect(p.builders.list('fdoc').length).toBe(1);
    expect(p.builders.list('nfe').length).toBe(0); // NF-e não expõe builders via plugin (mantido no módulo original)
  });

  it('descoberta por capacidade retorna documentos corretos', async () => {
    const p = new FiscalPlatform();
    await p.discover([NFePlugin, FDocPlugin]);
    const emissores = p.documentos.suportam('emissao').map((d) => d.codigo).sort();
    expect(emissores).toEqual(['fdoc', 'nfe']);
  });

  it('rejeita registro duplicado do mesmo documento', async () => {
    const p = new FiscalPlatform();
    await p.use(FDocPlugin);
    await expect(p.use(FDocPlugin)).rejects.toThrow(/já registrado/);
  });

  it('validadores por documento agregam erros', async () => {
    const p = new FiscalPlatform();
    await p.use(FDocPlugin);
    const r = await p.validadores.runAll('fdoc', { total: -1 });
    expect(r.ok).toBe(false);
    expect(r.erros.some((e) => e.codigo === 'FD001')).toBe(true);
    expect(r.erros.some((e) => e.codigo === 'FD002')).toBe(true);
  });

  it('builder do plugin serializa payload conforme formato', async () => {
    const p = new FiscalPlatform();
    await p.use(FDocPlugin);
    const b = p.builders.get('fdoc', 'fdoc.xml')!;
    const xml = await b.build({ id: 'X1', total: 10 });
    expect(xml).toContain('<id>X1</id>');
    expect(xml).toContain('<total>10.00</total>');
  });

  it('serviço é resolvível por nome (versão mais alta por padrão)', async () => {
    const p = new FiscalPlatform();
    await p.use(FDocPlugin);
    const s = p.servicos.resolve('fdoc', 'authorize');
    expect(s?.versao).toBe('1.0');
    const r = await s!.handler();
    expect((r as { status: number }).status).toBe(100);
  });

  it('layouts coexistem em versões distintas', async () => {
    const p = new FiscalPlatform();
    p.layouts.register({ chave: 'nfe.autorizacao', versao: '3.10', documento: 'nfe' });
    p.layouts.register({ chave: 'nfe.autorizacao', versao: '4.00', documento: 'nfe' });
    expect(p.layouts.listByChave('nfe.autorizacao').map((l) => l.versao).sort()).toEqual(['3.10', '4.00']);
  });

  it('workflow executor compensa passos quando um passo falha', async () => {
    const exec = new WorkflowExecutor();
    const log: string[] = [];
    const r = await exec.run({
      id: 'wf', documento: 'fdoc', capacidade: 'emissao',
      passos: [
        { id: 'p1', execute: async () => { log.push('p1'); }, compensate: async () => { log.push('c1'); } },
        { id: 'p2', execute: async () => { throw new Error('falhou'); }, compensate: async () => { log.push('c2'); } },
      ],
    }, { documento: 'fdoc', correlationId: 'cid', data: {} });
    expect(r.ok).toBe(false);
    expect(r.executados).toEqual(['p1']);
    expect(r.compensados).toEqual(['p1']);
    expect(log).toEqual(['p1', 'c1']);
  });

  it('workflow do plugin fictício executa fim-a-fim com sucesso', async () => {
    const p = new FiscalPlatform();
    await p.use(FDocPlugin);
    const wf = p.workflows.get('fdoc', 'emissao')!;
    const ctx = { documento: 'fdoc' as const, correlationId: 'c', data: {} as Record<string, unknown> };
    const r = await p.executor.run(wf, ctx);
    expect(r.ok).toBe(true);
    expect(ctx.data.validado).toBe(true);
    expect(ctx.data.protocolo).toBe('FDOC-1');
  });

  it('integração é materializada uma única vez (cache)', async () => {
    const p = new FiscalPlatform();
    let count = 0;
    p.integracoes.register({
      id: 'ws.mock', tipo: 'terceiro',
      adapter: () => { count++; return { async invoke() { return { ok: true }; } }; },
    });
    p.integracoes.resolve('ws.mock');
    p.integracoes.resolve('ws.mock');
    expect(count).toBe(1);
  });
});
