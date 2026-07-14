import { describe, it, expect } from 'vitest';
import {
  E2ERunner,
  CargaService,
  RecuperacaoService,
  HardeningChecklist,
  AuditoriaArquitetural,
  RelatorioHomologacaoService,
} from '../index';
import {
  ConsolidacaoFiscal,
  ApuracaoTributaria,
  FechamentoFiscal,
  ConsistenciasFiscais,
  InMemoryPeriodoRepository,
  InMemoryDocumentoConsolidadoRepository,
  InMemoryParametroRepository,
  InMemoryApuracaoRepository,
  InMemoryInconsistenciasRepository,
  InMemoryLivroRepository,
  StaticRegimeProvider,
  type EscrituracaoDeps,
  type DocumentoConsolidado,
  type ParametroTributario,
} from '../../escrituracao';

function mkDeps(): EscrituracaoDeps {
  return {
    periodos: new InMemoryPeriodoRepository(),
    documentos: new InMemoryDocumentoConsolidadoRepository(),
    parametros: new InMemoryParametroRepository(),
    apuracoes: new InMemoryApuracaoRepository(),
    inconsistencias: new InMemoryInconsistenciasRepository(),
    livros: new InMemoryLivroRepository(),
    regime: new StaticRegimeProvider('lucro_presumido'),
  };
}

function mkDoc(id: string, over: Partial<DocumentoConsolidado> = {}): DocumentoConsolidado {
  return {
    id,
    empresaId: 'e1',
    periodoId: 'p1',
    tipo: 'nfe',
    operacao: 'saida',
    dataEmissao: '2026-07-10',
    cfop: '5102',
    cst: '00',
    ncm: '12345678',
    valorTotal: 1000,
    baseIcms: 1000,
    situacao: 'valido',
    ...over,
  };
}

function mkParam(id: string, over: Partial<ParametroTributario> = {}): ParametroTributario {
  return {
    id,
    empresaId: 'e1',
    tributo: 'ICMS',
    regime: 'lucro_presumido',
    chave: 'ICMS|CFOP:5102|NCM:12345678',
    aliquota: 0.18,
    vigenciaInicio: '2026-01-01',
    ...over,
  };
}

describe('Etapa 11 — E2E Runner amarra fluxos', () => {
  it('executa fluxo consolidação → apuração → fechamento sem erros', async () => {
    const deps = mkDeps();
    const runner = new E2ERunner();

    runner.registrar('consolidacao_fiscal', async () => {
      await deps.parametros.upsert(mkParam('pa1'));
      await new ConsolidacaoFiscal(deps).executar({
        periodoId: 'p1',
        documentos: [mkDoc('d1'), mkDoc('d2', { operacao: 'entrada', cfop: '1102' })],
      });
    });

    runner.registrar('apuracao_tributaria', async () => {
      await deps.parametros.upsert(mkParam('pa2', { chave: 'ICMS|CFOP:1102|NCM:12345678' }));
      await new ApuracaoTributaria(deps).executar({
        periodoId: 'p1',
        empresaId: 'e1',
        tributos: ['ICMS'],
      });
    });

    runner.registrar('fechamento_periodo', async () => {
      const f = new FechamentoFiscal(deps);
      const p = await f.abrir('e1', 2026, 7, 'p1-fech');
      const p2 = await f.iniciarApuracao(p);
      const p3 = await f.marcarApurado(p2);
      await f.fechar(p3, 'u1');
    });

    const resultados = await runner.executarTodos();
    expect(resultados.every((r) => r.sucesso)).toBe(true);
    expect(resultados).toHaveLength(3);
  });

  it('reporta erro quando fluxo lança exceção', async () => {
    const runner = new E2ERunner();
    runner.registrar('emissao_nfe', async () => { throw new Error('boom'); });
    const r = await runner.executar('emissao_nfe');
    expect(r.sucesso).toBe(false);
    expect(r.erros[0]).toBe('boom');
  });
});

describe('Etapa 11 — Carga', () => {
  it('executa 100 documentos com concorrência 10', async () => {
    const svc = new CargaService();
    const contador = { n: 0 };
    const r = await svc.executar({
      total: 100,
      concorrencia: 10,
      fabrica: (i) => i,
      executar: async () => { contador.n++; },
    });
    expect(r.totalDocumentos).toBe(100);
    expect(r.falhas).toBe(0);
    expect(contador.n).toBe(100);
    expect(r.throughputPorSegundo).toBeGreaterThan(0);
  });
});

describe('Etapa 11 — Recuperação', () => {
  it('recupera após 2 falhas iniciais', async () => {
    const svc = new RecuperacaoService();
    const r = await svc.executar({
      nome: 'sefaz-timeout',
      falhasIniciais: 2,
      maxTentativas: 5,
      operacao: async () => {},
      backoffMs: () => 1,
    });
    expect(r.recuperado).toBe(true);
    expect(r.tentativas).toBe(3);
    expect(r.disparouRetry).toBe(true);
  });

  it('desiste após esgotar tentativas', async () => {
    const svc = new RecuperacaoService();
    const r = await svc.executar({
      nome: 'sefaz-off',
      falhasIniciais: 10,
      maxTentativas: 3,
      operacao: async () => {},
    });
    expect(r.recuperado).toBe(false);
    expect(r.tentativas).toBe(3);
  });
});

describe('Etapa 11 — Hardening', () => {
  it('avalia checklist canônico e resume pendências', () => {
    const svc = new HardeningChecklist();
    const items = svc.avaliar({});
    expect(items.length).toBeGreaterThanOrEqual(10);
    expect(svc.resumo(items).pendentes.length).toBe(0);
  });

  it('detecta pendência quando item desligado', () => {
    const svc = new HardeningChecklist();
    const nome = 'RLS habilitada em todas as tabelas fiscal_*';
    const items = svc.avaliar({ [nome]: false });
    expect(svc.resumo(items).pendentes).toContain(nome);
  });
});

describe('Etapa 11 — Auditoria arquitetural', () => {
  it('flagra domain importando infrastructure', () => {
    const v = new AuditoriaArquitetural().analisar([
      { origem: 'nfe/domain/entities', destino: 'nfe/infrastructure/xml' },
    ]);
    expect(v).toHaveLength(1);
    expect(v[0].regra).toBe('domain-nao-depende-de-infra');
  });

  it('passa quando application usa contratos', () => {
    const v = new AuditoriaArquitetural().analisar([
      { origem: 'nfe/application/authorizeUseCase', destino: 'nfe/application/contracts' },
    ]);
    expect(v).toHaveLength(0);
  });
});

describe('Etapa 11 — Relatório de homologação', () => {
  it('marca apto quando todos os critérios atendem', () => {
    const svc = new RelatorioHomologacaoService();
    const rel = svc.gerar({
      arquitetura: { pontosFortes: ['Clean Architecture'], limitacoes: [], melhorias: [] },
      metricas: { p95_autorizacao_ms: 800 },
      benchmarks: [{ totalDocumentos: 1000, concorrencia: 20, duracaoTotalMs: 5000, throughputPorSegundo: 200, falhas: 0 }],
      gargalosCorrigidos: [],
      hardening: new HardeningChecklist().avaliar({}),
      riscosSeguranca: [], correcoesSeguranca: [], recomendacoesSeguranca: [],
      cobertura: 0.85,
      cenarios: [{ fluxo: 'consolidacao_fiscal', sucesso: true, duracaoMs: 10, erros: [] }],
      falhasCorrigidas: [],
      producaoChecklist: [{ item: 'RLS ativa', ok: true }],
      riscosResiduais: [],
      recomendacoesFinais: ['Executar carga em ambiente pré-produtivo'],
    });
    expect(rel.producao.aptoParaHomologacao).toBe(true);
    expect(rel.testes.cobertura).toBe(0.85);
  });

  it('marca não apto se cobertura < 70%', () => {
    const rel = new RelatorioHomologacaoService().gerar({
      arquitetura: { pontosFortes: [], limitacoes: [], melhorias: [] },
      metricas: {},
      benchmarks: [],
      gargalosCorrigidos: [],
      hardening: [],
      riscosSeguranca: [], correcoesSeguranca: [], recomendacoesSeguranca: [],
      cobertura: 0.5,
      cenarios: [],
      falhasCorrigidas: [],
      producaoChecklist: [],
      riscosResiduais: [],
      recomendacoesFinais: [],
    });
    expect(rel.producao.aptoParaHomologacao).toBe(false);
  });
});
