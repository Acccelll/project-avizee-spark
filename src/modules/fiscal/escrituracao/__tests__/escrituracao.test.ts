import { describe, it, expect } from 'vitest';
import {
  MotorTributario,
  ApuracaoTributaria,
  ConsolidacaoFiscal,
  ConsistenciasFiscais,
  LivrosFiscais,
  FechamentoFiscal,
  DashboardsFiscais,
  InMemoryPeriodoRepository,
  InMemoryDocumentoConsolidadoRepository,
  InMemoryParametroRepository,
  InMemoryApuracaoRepository,
  InMemoryInconsistenciasRepository,
  InMemoryLivroRepository,
  StaticRegimeProvider,
  SpedLayoutRegistry,
  SpedSerializer,
  serializarLinha,
  cfopCompativelComOperacao,
  cstIcmsValido,
  csosnValido,
  podeTransicionar,
  type DocumentoConsolidado,
  type ParametroTributario,
  type EscrituracaoDeps,
} from '../index';

function mkDoc(over: Partial<DocumentoConsolidado> = {}): DocumentoConsolidado {
  return {
    id: over.id ?? 'd1',
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

function mkParam(over: Partial<ParametroTributario> = {}): ParametroTributario {
  return {
    id: 'pa1',
    empresaId: 'e1',
    tributo: 'ICMS',
    regime: 'lucro_presumido',
    chave: 'ICMS|CFOP:5102|NCM:12345678',
    aliquota: 0.18,
    vigenciaInicio: '2026-01-01',
    ...over,
  };
}

function mkDeps(regime: 'simples_nacional' | 'lucro_presumido' | 'lucro_real' | 'mei' = 'lucro_presumido'): EscrituracaoDeps {
  return {
    periodos: new InMemoryPeriodoRepository(),
    documentos: new InMemoryDocumentoConsolidadoRepository(),
    parametros: new InMemoryParametroRepository(),
    apuracoes: new InMemoryApuracaoRepository(),
    inconsistencias: new InMemoryInconsistenciasRepository(),
    livros: new InMemoryLivroRepository(),
    regime: new StaticRegimeProvider(regime),
  };
}

describe('Escrituração — regras de domínio', () => {
  it('valida CFOP por operação', () => {
    expect(cfopCompativelComOperacao('5102', 'saida')).toBe(true);
    expect(cfopCompativelComOperacao('1102', 'entrada')).toBe(true);
    expect(cfopCompativelComOperacao('5102', 'entrada')).toBe(false);
    expect(cfopCompativelComOperacao('999', 'saida')).toBe(false);
  });

  it('valida CST e CSOSN', () => {
    expect(cstIcmsValido('00')).toBe(true);
    expect(cstIcmsValido('99')).toBe(false);
    expect(csosnValido('102')).toBe(true);
    expect(csosnValido('999')).toBe(false);
  });

  it('máquina de estados de período', () => {
    expect(podeTransicionar('aberto', 'em_apuracao')).toBe(true);
    expect(podeTransicionar('fechado', 'apurado')).toBe(false);
    expect(podeTransicionar('fechado', 'reaberto')).toBe(true);
  });
});

describe('Escrituração — motor tributário', () => {
  it('calcula ICMS via parâmetro vigente com redução de base', () => {
    const motor = new MotorTributario([mkParam({ aliquota: 0.18, reducaoBase: 0.1 })]);
    const [r] = motor.calcular(mkDoc(), ['ICMS']);
    expect(r.aliquota).toBe(0.18);
    expect(r.reducao).toBe(0.1);
    expect(r.valor).toBeCloseTo(162, 2);
  });

  it('trata isento e ausência de parâmetro', () => {
    const motor = new MotorTributario([mkParam({ isento: true })]);
    const [r] = motor.calcular(mkDoc(), ['ICMS']);
    expect(r.isento).toBe(true);
    expect(r.valor).toBe(0);

    const motor2 = new MotorTributario([]);
    const [r2] = motor2.calcular(mkDoc(), ['ICMS']);
    expect(r2.valor).toBe(0);
    expect(r2.origem).toBe('documento');
  });
});

describe('Escrituração — fluxo integrado', () => {
  it('consolida, apura e gera livros', async () => {
    const deps = mkDeps();
    await deps.parametros.upsert(mkParam({ aliquota: 0.18 }));
    const saida = mkDoc({ id: 's1', operacao: 'saida', cfop: '5102' });
    const entrada = mkDoc({ id: 'e1x', operacao: 'entrada', cfop: '1102' });
    await new ConsolidacaoFiscal(deps).executar({ periodoId: 'p1', documentos: [saida, entrada] });

    await deps.parametros.upsert(mkParam({ id: 'pa2', chave: 'ICMS|CFOP:1102|NCM:12345678', aliquota: 0.18 }));

    const apuracao = await new ApuracaoTributaria(deps).executar({
      periodoId: 'p1', empresaId: 'e1', tributos: ['ICMS'],
    });
    const icms = apuracao.tributos.find((t) => t.tributo === 'ICMS')!;
    expect(icms.debitos).toBeCloseTo(180, 2);
    expect(icms.creditos).toBeCloseTo(180, 2);
    expect(icms.saldoAPagar).toBe(0);

    const docs = await deps.documentos.listarPorPeriodo('p1');
    const livros = new LivrosFiscais();
    const saidas = livros.gerarSaidas('p1', 'e1', docs);
    expect(saidas.tipo).toBe('saidas');
    expect(saidas.linhas.length).toBe(1);
  });

  it('fechamento com versionamento em reabertura', async () => {
    const deps = mkDeps();
    const f = new FechamentoFiscal(deps);
    const p = await f.abrir('e1', 2026, 7, 'p1');
    const p2 = await f.iniciarApuracao(p);
    const p3 = await f.marcarApurado(p2);
    const p4 = await f.fechar(p3, 'u1');
    expect(p4.status).toBe('fechado');
    const p5 = await f.reabrir(p4);
    expect(p5.status).toBe('reaberto');
    expect(p5.versao).toBe(2);
  });

  it('detecta inconsistências (CFOP e CST)', async () => {
    const deps = mkDeps();
    await deps.documentos.upsertLote([
      mkDoc({ id: 'x1', cfop: '5102', operacao: 'entrada' }),
      mkDoc({ id: 'x2', cst: '99' }),
    ]);
    const items = await new ConsistenciasFiscais(deps).analisar('p1', 'e1');
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it('dashboard agrega indicadores', async () => {
    const deps = mkDeps();
    await deps.documentos.upsertLote([
      mkDoc({ id: 'a', operacao: 'saida' }),
      mkDoc({ id: 'b', operacao: 'entrada', cfop: '1102' }),
    ]);
    const docs = await deps.documentos.listarPorPeriodo('p1');
    const ind = new DashboardsFiscais().gerar(docs, null, []);
    expect(ind.documentosEmitidos).toBe(1);
    expect(ind.documentosRecebidos).toBe(1);
  });
});

describe('Escrituração — infraestrutura SPED', () => {
  it('serializa linha simples', () => {
    expect(serializarLinha({ registro: '0000', valores: ['A', 1, null] })).toBe('|0000|A|1||');
  });

  it('valida contra layout registrado', () => {
    const reg = new SpedLayoutRegistry();
    reg.registrar({ codigo: '0000', bloco: '0', versao: '017', campos: ['COD_VER', 'COD_FIN', 'DT_INI'] });
    const ser = new SpedSerializer(reg, '017');
    const out = ser.serializarBloco('0', [{ registro: '0000', valores: ['017', '0', '01072026'] }]);
    expect(out).toContain('|0000|017|0|01072026|');
    expect(() => ser.serializarBloco('0', [{ registro: '0000', valores: ['017'] }])).toThrow();
  });
});
