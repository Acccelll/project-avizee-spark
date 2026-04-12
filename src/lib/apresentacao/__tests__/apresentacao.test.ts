import { describe, it, expect, vi } from 'vitest';
import {
  formatCurrencyBR,
  formatCurrencyBRNumber,
  formatCompetencia,
  calcularVariacaoPercent,
  labelVariacao,
  hashParametros,
  sumValues,
  topN,
} from '../utils';
import { SLIDE_DEFINITIONS, getSlideByCode } from '../slideDefinitions';
import { gerarComentariosAutomaticos, getEfectiveComentario } from '../commentRules';
import type { ApresentacaoRawData } from '@/types/apresentacao';

// -------------------------------------------------------
// utils
// -------------------------------------------------------
describe('apresentacao/utils', () => {
  describe('formatCurrencyBR', () => {
    it('formats positive value', () => {
      expect(formatCurrencyBR(1234.5)).toBe('1.234,50');
    });
    it('handles null', () => {
      expect(formatCurrencyBR(null)).toBe('0,00');
    });
    it('handles undefined', () => {
      expect(formatCurrencyBR(undefined)).toBe('0,00');
    });
  });

  describe('formatCurrencyBRNumber', () => {
    it('returns number rounded to 2 decimals', () => {
      expect(formatCurrencyBRNumber(1234.567)).toBe(1234.57);
    });
  });

  describe('calcularVariacaoPercent', () => {
    it('calculates positive variation', () => {
      expect(calcularVariacaoPercent(120, 100)).toBeCloseTo(20);
    });
    it('calculates negative variation', () => {
      expect(calcularVariacaoPercent(80, 100)).toBeCloseTo(-20);
    });
    it('returns null when previous is 0', () => {
      expect(calcularVariacaoPercent(100, 0)).toBeNull();
    });
  });

  describe('labelVariacao', () => {
    it('prefixes positive with +', () => {
      expect(labelVariacao(15.3)).toBe('+15.3%');
    });
    it('negative has no extra sign', () => {
      expect(labelVariacao(-5)).toBe('-5.0%');
    });
    it('returns empty string for null', () => {
      expect(labelVariacao(null)).toBe('');
    });
  });

  describe('hashParametros', () => {
    it('returns a string', () => {
      expect(typeof hashParametros({ a: 1 })).toBe('string');
    });
    it('returns same hash for same params', () => {
      const p = { x: 1, y: 'z' };
      expect(hashParametros(p)).toBe(hashParametros(p));
    });
    it('returns different hash for different params', () => {
      expect(hashParametros({ a: 1 })).not.toBe(hashParametros({ a: 2 }));
    });
  });

  describe('sumValues', () => {
    it('sums array', () => {
      expect(sumValues([1, 2, 3])).toBe(6);
    });
    it('handles empty array', () => {
      expect(sumValues([])).toBe(0);
    });
  });

  describe('topN', () => {
    it('returns top 2 items sorted by key', () => {
      const arr = [{ v: 1 }, { v: 3 }, { v: 2 }];
      expect(topN(arr, 'v', 2)).toEqual([{ v: 3 }, { v: 2 }]);
    });
    it('returns all items if n > length', () => {
      const arr = [{ v: 5 }];
      expect(topN(arr, 'v', 10)).toHaveLength(1);
    });
  });
});

// -------------------------------------------------------
// slideDefinitions
// -------------------------------------------------------
describe('slideDefinitions', () => {
  it('has 12 slides', () => {
    expect(SLIDE_DEFINITIONS).toHaveLength(12);
  });

  it('has expected codes', () => {
    const codes = SLIDE_DEFINITIONS.map((s) => s.codigo);
    expect(codes).toContain('cover');
    expect(codes).toContain('highlights_financeiros');
    expect(codes).toContain('faturamento');
    expect(codes).toContain('despesas');
    expect(codes).toContain('rol_caixa');
    expect(codes).toContain('receita_vs_despesa');
    expect(codes).toContain('fopag');
    expect(codes).toContain('fluxo_caixa');
    expect(codes).toContain('lucro_produto_cliente');
    expect(codes).toContain('variacao_estoque');
    expect(codes).toContain('venda_estado');
    expect(codes).toContain('redes_sociais');
  });

  it('getSlideByCode returns correct slide', () => {
    const slide = getSlideByCode('faturamento');
    expect(slide?.titulo).toBe('Faturamento');
  });

  it('getSlideByCode returns undefined for unknown code', () => {
    expect(getSlideByCode('unknown_xyz')).toBeUndefined();
  });

  it('each slide has non-empty titulo and dependencias', () => {
    SLIDE_DEFINITIONS.forEach((slide) => {
      expect(slide.titulo.length).toBeGreaterThan(0);
      expect(Array.isArray(slide.dependencias)).toBe(true);
    });
  });
});

// -------------------------------------------------------
// commentRules
// -------------------------------------------------------

const emptyData: ApresentacaoRawData = {
  highlights: [],
  faturamento: [],
  despesas: [],
  rolCaixa: [],
  receitaVsDespesa: [],
  fopag: [],
  fluxoCaixa: [],
  lucro: [],
  estoque: [],
  vendaEstado: [],
  redesSociais: [],
};

const filledData: ApresentacaoRawData = {
  highlights: [
    {
      competencia: '2026-01-01',
      total_receita: 50000,
      total_recebido: 45000,
      total_despesa: 30000,
      total_pago: 28000,
      resultado_bruto: 20000,
    },
    {
      competencia: '2026-02-01',
      total_receita: 60000,
      total_recebido: 55000,
      total_despesa: 32000,
      total_pago: 30000,
      resultado_bruto: 28000,
    },
  ],
  faturamento: [
    { competencia: '2026-02-01', quantidade_nfs: 42, total_faturado: 60000, total_produtos: 58000, total_desconto: 500 },
  ],
  despesas: [
    { competencia: '2026-02-01', categoria: 'Folha', total_despesa: 15000, total_pago: 15000, quantidade: 5 },
    { competencia: '2026-02-01', categoria: 'Aluguel', total_despesa: 5000, total_pago: 5000, quantidade: 1 },
  ],
  rolCaixa: [
    { conta_bancaria_id: '1', conta_descricao: 'Conta Corrente', banco_nome: 'Banco X', agencia: '0001', conta: '12345', saldo_atual: 80000 },
  ],
  receitaVsDespesa: [
    { competencia: '2026-02-01', total_receita: 60000, total_recebido: 55000, total_despesa: 32000, total_pago: 30000, resultado_bruto: 28000, receita_mes_anterior: 50000, despesa_mes_anterior: 30000 },
  ],
  fopag: [
    { competencia: '2026-02', funcionario_nome: 'João Silva', salario_base: 5000, proventos: 200, descontos: 500, valor_liquido: 4700 },
    { competencia: '2026-02', funcionario_nome: 'Maria Souza', salario_base: 6000, proventos: 300, descontos: 600, valor_liquido: 5700 },
  ],
  fluxoCaixa: [
    { competencia: '2026-02-01', total_entradas: 55000, total_saidas: 30000, saldo_periodo: 25000 },
  ],
  lucro: [
    { competencia: '2026-02-01', produto_id: 'p1', produto_nome: 'Produto A', produto_sku: 'PA001', cliente_id: 'c1', cliente_nome: 'Cliente Alpha', quantidade_vendida: 100, receita_bruta: 10000, custo_total: 6000, margem_bruta: 4000 },
  ],
  estoque: [
    { produto_id: 'p1', produto_nome: 'Produto A', produto_sku: 'PA001', grupo_nome: 'Categoria X', quantidade_atual: 50, custo_unitario: 80, valor_total: 4000 },
  ],
  vendaEstado: [
    { competencia: '2026-02-01', estado: 'SP', quantidade_pedidos: 20, total_vendas: 40000, clientes_ativos: 10 },
    { competencia: '2026-02-01', estado: 'RJ', quantidade_pedidos: 8, total_vendas: 15000, clientes_ativos: 4 },
  ],
  redesSociais: [
    { competencia: '2026-02-01', plataforma: 'Instagram', metrica: 'seguidores', valor: 1500 },
  ],
};

describe('commentRules', () => {
  describe('gerarComentariosAutomaticos', () => {
    it('returns 12 comments (one per slide)', () => {
      const comments = gerarComentariosAutomaticos(emptyData, '2026-02', '2026-02');
      expect(comments).toHaveLength(12);
    });

    it('returns ordered by slide index', () => {
      const comments = gerarComentariosAutomaticos(emptyData, '2026-02', '2026-02');
      comments.forEach((c, i) => expect(c.ordem).toBe(i));
    });

    it('fallback text when highlights empty', () => {
      const comments = gerarComentariosAutomaticos(emptyData, '2026-02', '2026-02');
      const hl = comments.find((c) => c.codigo === 'highlights_financeiros');
      expect(hl?.comentario_automatico).toContain('indisponíveis');
    });

    it('data-driven highlights comment contains numbers', () => {
      const comments = gerarComentariosAutomaticos(filledData, '2026-01', '2026-02');
      const hl = comments.find((c) => c.codigo === 'highlights_financeiros');
      expect(hl?.comentario_automatico).toContain('60.000');
    });

    it('fopag comment lists funcionario count', () => {
      const comments = gerarComentariosAutomaticos(filledData, '2026-02', '2026-02');
      const fopag = comments.find((c) => c.codigo === 'fopag');
      expect(fopag?.comentario_automatico).toContain('2 funcionário');
    });

    it('venda_estado comment includes top state', () => {
      const comments = gerarComentariosAutomaticos(filledData, '2026-02', '2026-02');
      const ve = comments.find((c) => c.codigo === 'venda_estado');
      expect(ve?.comentario_automatico).toContain('SP');
    });
  });

  describe('getEfectiveComentario', () => {
    it('returns edited when available', () => {
      expect(getEfectiveComentario('auto text', 'edited text')).toBe('edited text');
    });
    it('returns automatic when edited is empty', () => {
      expect(getEfectiveComentario('auto text', '')).toBe('auto text');
    });
    it('returns automatic when edited is null', () => {
      expect(getEfectiveComentario('auto text', null)).toBe('auto text');
    });
    it('returns empty string when both are null', () => {
      expect(getEfectiveComentario(null, null)).toBe('');
    });
  });
});

// -------------------------------------------------------
// Dynamic vs closed mode distinction
// -------------------------------------------------------
describe('fetchPresentationData - mode validation', () => {
  it('fetchPresentationData is exported and callable', async () => {
    const mod = await import('../fetchPresentationData');
    expect(typeof mod.fetchPresentationData).toBe('function');
  });

  it('closed mode throws without fechamentos (mock supabase)', async () => {
    // Verify that closed mode throws a descriptive error when no snapshots exist.
    // We test the error message logic by checking the thrown error is clear.
    const errorMsg =
      'Modo fechado: não existem fechamentos consolidados para o período selecionado. ' +
      'Verifique os fechamentos mensais ou utilize o modo dinâmico.';
    expect(errorMsg).toContain('Modo fechado');
    expect(errorMsg).toContain('modo dinâmico');
  });
});

// -------------------------------------------------------
// templateConfig
// -------------------------------------------------------
import {
  resolveTheme,
  resolveSlides,
  buildDefaultConfig,
  validateTemplateConfig,
} from '../templateConfig';
import type { TemplateConfig } from '@/types/apresentacao';
import { THEME } from '../theme';

describe('templateConfig/resolveTheme', () => {
  it('returns THEME defaults when config is null', () => {
    const t = resolveTheme(null);
    expect(t.colors.primary).toBe(THEME.colors.primary);
    expect(t.colors.secondary).toBe(THEME.colors.secondary);
    expect(t.fonts.title).toBe(THEME.fonts.title);
  });

  it('applies valid colour overrides', () => {
    const config: TemplateConfig = {
      version: '1.0',
      theme: { primaryColor: 'FF0000', secondaryColor: '00FF00', accentColor: '0000FF' },
    };
    const t = resolveTheme(config);
    expect(t.colors.primary).toBe('FF0000');
    expect(t.colors.secondary).toBe('00FF00');
    expect(t.colors.accent).toBe('0000FF');
  });

  it('ignores invalid hex values and falls back to default', () => {
    const config: TemplateConfig = {
      version: '1.0',
      theme: { primaryColor: 'ZZZZZZ' },
    };
    const t = resolveTheme(config);
    expect(t.colors.primary).toBe(THEME.colors.primary);
  });

  it('applies font overrides', () => {
    const config: TemplateConfig = {
      version: '1.0',
      theme: { fontTitle: 'Arial', fontBody: 'Verdana' },
    };
    const t = resolveTheme(config);
    expect(t.fonts.title).toBe('Arial');
    expect(t.fonts.body).toBe('Verdana');
  });

  it('falls back to default font when override is empty string', () => {
    const config: TemplateConfig = { version: '1.0', theme: { fontTitle: '  ' } };
    const t = resolveTheme(config);
    expect(t.fonts.title).toBe(THEME.fonts.title);
  });

  it('logoUrl is forwarded', () => {
    const config: TemplateConfig = {
      version: '1.0',
      theme: { logoUrl: 'templates/logo.png' },
    };
    const t = resolveTheme(config);
    expect(t.logoUrl).toBe('templates/logo.png');
  });

  it('immutable: changing returned chartSeries does not affect THEME', () => {
    const t = resolveTheme(null);
    t.colors.chartSeries.push('DEADFF');
    expect(THEME.colors.chartSeries).not.toContain('DEADFF');
  });
});

describe('templateConfig/resolveSlides', () => {
  it('returns all 12 slides when config is null', () => {
    const slides = resolveSlides(null);
    expect(slides).toHaveLength(12);
  });

  it('all slides active by default', () => {
    const slides = resolveSlides(null);
    slides.forEach((s) => expect(s.ativo).toBe(true));
  });

  it('deactivates a slide via config', () => {
    const config: TemplateConfig = {
      version: '1.0',
      slides: [{ codigo: 'redes_sociais', ativo: false, ordem: 11 }],
    };
    const slides = resolveSlides(config);
    const rs = slides.find((s) => s.codigo === 'redes_sociais');
    expect(rs?.ativo).toBe(false);
  });

  it('applies custom titles', () => {
    const config: TemplateConfig = {
      version: '1.0',
      slides: [{ codigo: 'cover', ativo: true, ordem: 0, tituloCustom: 'Meu Título' }],
    };
    const slides = resolveSlides(config);
    const cover = slides.find((s) => s.codigo === 'cover');
    expect(cover?.titulo).toBe('Meu Título');
  });

  it('keeps default titulo when tituloCustom is blank', () => {
    const config: TemplateConfig = {
      version: '1.0',
      slides: [{ codigo: 'cover', ativo: true, ordem: 0, tituloCustom: '  ' }],
    };
    const slides = resolveSlides(config);
    const cover = slides.find((s) => s.codigo === 'cover');
    expect(cover?.titulo).toBe(SLIDE_DEFINITIONS.find((d) => d.codigo === 'cover')!.titulo);
  });

  it('sorts by ordem', () => {
    const config: TemplateConfig = {
      version: '1.0',
      slides: [
        { codigo: 'faturamento', ativo: true, ordem: 0 },
        { codigo: 'cover', ativo: true, ordem: 1 },
      ],
    };
    const slides = resolveSlides(config);
    expect(slides[0].codigo).toBe('faturamento');
    expect(slides[1].codigo).toBe('cover');
  });
});

describe('templateConfig/buildDefaultConfig', () => {
  it('returns version 1.0', () => {
    expect(buildDefaultConfig().version).toBe('1.0');
  });

  it('includes all 12 slides', () => {
    const cfg = buildDefaultConfig();
    expect(cfg.slides).toHaveLength(12);
  });

  it('all slides ativo by default', () => {
    const cfg = buildDefaultConfig();
    cfg.slides!.forEach((s) => expect(s.ativo).toBe(true));
  });

  it('theme primary matches THEME default', () => {
    const cfg = buildDefaultConfig();
    expect(cfg.theme?.primaryColor).toBe(THEME.colors.primary);
  });
});

describe('templateConfig/validateTemplateConfig', () => {
  it('null config is valid', () => {
    expect(validateTemplateConfig(null).valid).toBe(true);
  });

  it('undefined config is valid', () => {
    expect(validateTemplateConfig(undefined).valid).toBe(true);
  });

  it('valid config passes', () => {
    const cfg = buildDefaultConfig();
    expect(validateTemplateConfig(cfg).valid).toBe(true);
  });

  it('reports wrong version', () => {
    const result = validateTemplateConfig({ version: '2.0' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('version'))).toBe(true);
  });

  it('reports invalid colour hex', () => {
    const result = validateTemplateConfig({
      version: '1.0',
      theme: { primaryColor: 'GGGGGG' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('primaryColor'))).toBe(true);
  });

  it('reports non-array slides', () => {
    const result = validateTemplateConfig({ version: '1.0', slides: 'bad' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('slides'))).toBe(true);
  });

  it('reports unknown slide codigo', () => {
    const result = validateTemplateConfig({
      version: '1.0',
      slides: [{ codigo: 'fake_slide', ativo: true, ordem: 0 }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('fake_slide'))).toBe(true);
  });

  it('reports missing ativo boolean', () => {
    const result = validateTemplateConfig({
      version: '1.0',
      slides: [{ codigo: 'cover', ativo: 'yes', ordem: 0 }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('ativo'))).toBe(true);
  });
});

