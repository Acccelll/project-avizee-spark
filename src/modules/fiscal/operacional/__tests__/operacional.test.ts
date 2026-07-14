import { describe, it, expect } from 'vitest';
import {
  FiscalDashboardService,
  SefazMonitorService,
  ProcessamentoService,
  PendenciasService,
  NotificacoesFiscaisService,
  CertificadoService,
  BuscaGlobalFiscalService,
  ObservabilidadeService,
  ProntidaoProducaoService,
  ehPermissaoFiscal,
  PERMISSOES_FISCAIS,
  type ProcessamentoJob,
  type PendenciaFiscal,
  type NotificacaoFiscal,
  type CertificadoInfo,
} from '../index';

describe('Etapa 10 — Dashboard', () => {
  it('resume documentos e calcula taxa de autorização', () => {
    const s = new FiscalDashboardService();
    const input = {
      documentos: { emitidos: 10, recebidos: 5, autorizadas: 8, rejeitadas: 2, canceladas: 1 },
      distDFe: { pendentes: 3 },
      escrituracao: { inconsistencias: 1 },
      processamento: { pendentes: 4 },
    };
    const r = s.resumir(input);
    expect(r.emitidos).toBe(10);
    expect(r.distDFePendentes).toBe(3);
    expect(s.taxaAutorizacao(input)).toBeCloseTo(0.8, 4);
  });
});

describe('Etapa 10 — Monitor SEFAZ', () => {
  it('classifica indisponível quando breaker aberto', () => {
    const s = new SefazMonitorService();
    const [r] = s.agregar([
      { uf: 'SP', ambiente: 'producao', servico: 'NfeAutorizacao', latenciaMs: 100, sucesso: false, breaker: 'open', timestamp: new Date().toISOString() },
    ]);
    expect(r.status).toBe('indisponivel');
  });

  it('classifica lento quando latência alta', () => {
    const s = new SefazMonitorService();
    const [r] = s.agregar([
      { uf: 'SP', ambiente: 'producao', servico: 'NfeAutorizacao', latenciaMs: 2000, sucesso: true, breaker: 'closed', timestamp: new Date().toISOString() },
    ]);
    expect(r.status).toBe('lento');
  });
});

describe('Etapa 10 — Processamento', () => {
  it('agrega snapshot de filas', async () => {
    const now = new Date().toISOString();
    const jobs: ProcessamentoJob[] = [
      { id: '1', fila: 'nfe', tipo: 'autorizar', status: 'pendente', criadoEm: now, atualizadoEm: now, tentativas: 0 },
      { id: '2', fila: 'nfe', tipo: 'autorizar', status: 'concluido', criadoEm: now, atualizadoEm: now, tentativas: 1 },
      { id: '3', fila: 'distdfe', tipo: 'consultar', status: 'falhou', criadoEm: now, atualizadoEm: now, tentativas: 3 },
    ];
    const repo = { listar: async () => jobs, atualizar: async (id, p) => ({ ...jobs.find((j) => j.id === id)!, ...p }) };
    const snap = await new ProcessamentoService(repo).snapshotFilas();
    expect(snap.length).toBe(2);
    expect(snap.find((s) => s.nome === 'nfe')?.pendentes).toBe(1);
  });
});

describe('Etapa 10 — Pendências', () => {
  it('resume por severidade e sugere ação', async () => {
    const items: PendenciaFiscal[] = [
      { id: '1', empresaId: 'e', tipo: 'nfe_rejeitada', severidade: 'alta', titulo: 't', descricao: 'd', criadoEm: new Date().toISOString() },
      { id: '2', empresaId: 'e', tipo: 'certificado_expirado', severidade: 'critica', titulo: 't', descricao: 'd', criadoEm: new Date().toISOString() },
    ];
    const repo = {
      listar: async () => items,
      registrar: async (p: PendenciaFiscal) => p,
      resolver: async (id: string) => items.find((i) => i.id === id)!,
    };
    const svc = new PendenciasService(repo);
    expect((await svc.resumo()).alta).toBe(1);
    expect(svc.sugerirAcao({ tipo: 'certificado_expirado' })).toMatch(/certificado/i);
  });
});

describe('Etapa 10 — Notificações', () => {
  it('emite e envia por canais registrados', async () => {
    const enviados: string[] = [];
    const repo = { registrar: async (n: NotificacaoFiscal) => n, listar: async () => [], marcarLida: async () => {} };
    const canal = { nome: 'app' as const, enviar: async (n: NotificacaoFiscal) => { enviados.push(n.titulo); } };
    const svc = new NotificacoesFiscaisService(repo, [canal]);
    const n = await svc.emitir({
      empresaId: 'e', categoria: 'nfe', titulo: 'NFe autorizada', mensagem: 'ok',
      severidade: 'info', canais: ['app'],
    });
    expect(n.id).toBeDefined();
    expect(enviados).toContain('NFe autorizada');
    expect(svc.categoriaDeEvento('fiscal.nfe.autorizada')).toBe('nfe');
  });
});

describe('Etapa 10 — Certificados', () => {
  it('detecta certificados a vencer', async () => {
    const proximo = new Date(Date.now() + 5 * 86_400_000).toISOString();
    const longe = new Date(Date.now() + 120 * 86_400_000).toISOString();
    const items: CertificadoInfo[] = [
      { id: '1', empresaId: 'e', cnpj: '00', titular: 'x', ambiente: 'producao', validoAte: proximo, ativo: true },
      { id: '2', empresaId: 'e', cnpj: '00', titular: 'y', ambiente: 'producao', validoAte: longe, ativo: true },
    ];
    const repo = { listar: async () => items, registrar: async (c: CertificadoInfo) => c, desativar: async () => {} };
    const svc = new CertificadoService(repo);
    const proximos = await svc.proximosDoVencimento(30);
    expect(proximos.length).toBe(1);
    expect(svc.diasParaVencer({ validoAte: proximo })).toBeLessThanOrEqual(5);
  });
});

describe('Etapa 10 — Busca global', () => {
  const b = new BuscaGlobalFiscalService();
  it('classifica chave, CNPJ, CPF, protocolo', () => {
    expect(b.classificar('3'.repeat(44))).toBe('chave');
    expect(b.classificar('12345678000199')).toBe('cnpj');
    expect(b.classificar('12345678909')).toBe('cpf');
    expect(b.classificar('135240000000001')).toBe('protocolo');
    expect(b.classificar('12345')).toBe('numero');
  });
  it('sugere href por tipo', () => {
    expect(b.sugerirHref({ tipo: 'chave', valor: 'x', descricao: '' })).toContain('/fiscal?chave=');
  });
});

describe('Etapa 10 — Permissões', () => {
  it('cataloga permissões fiscais granulares', () => {
    expect(PERMISSOES_FISCAIS.length).toBeGreaterThanOrEqual(12);
    expect(ehPermissaoFiscal('fiscal_emissao', 'criar')).toBe(true);
    expect(ehPermissaoFiscal('foo', 'bar')).toBe(false);
  });
});

describe('Etapa 10 — Observabilidade', () => {
  it('registra métricas e spans', () => {
    const o = new ObservabilidadeService();
    o.incr('fiscal.nfe.autorizada', { uf: 'SP' });
    const s = o.startSpan('assinar_xml');
    o.endSpan(s, 'ok');
    const snap = o.snapshot();
    expect(snap.metrics.length).toBe(1);
    expect(snap.spans[0].durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe('Etapa 10 — Prontidão para produção', () => {
  it('gera checklist e detecta pendências', () => {
    const r = new ProntidaoProducaoService().gerar({
      arquiteturaOk: true, segurancaOk: true, desempenhoOk: true,
      observabilidadeOk: true, cobertura: 0.75, documentacaoOk: true,
      integracoesOk: true, bancoOk: true, migracoesOk: true,
      filasOk: true, cacheOk: true, logsOk: false, permissoesOk: true,
    });
    expect(r.pendentes.length).toBe(1);
    expect(r.riscos.length).toBe(1);
    expect(r.recomendacoes.length).toBeGreaterThanOrEqual(1);
  });
});
