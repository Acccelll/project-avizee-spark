import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { BaseFechamento, versaoSugerida, versoesDisponiveis } from '../base';
import { calcularAlertas } from '../alertas';
import { brl, mil, nomeCurto, pct, variacao } from '../formato';
import { desenhar } from '../graficos';
import { MAPA_BRASIL } from '../mapaBrasil';
import { aplicarEdicoes, montarDeck } from '../modelo';
import { gerarPptx } from '../pptx';
import type { Deck, Slide } from '../tipos';
import { dadosSinteticos } from './fixture';

const GERADO = new Date(2026, 9, 10);

function textos(s: Slide): string[] {
  const v = s.visual;
  const out = [s.mensagem, ...s.comentarios, s.fonte];
  if (v.tipo === 'kpis') v.itens.forEach((k) => out.push(k.valor, k.detalhe));
  if (v.tipo === 'ranking') v.itens.forEach((k) => out.push(k.rotulo, k.detalhe));
  if (v.tipo === 'tabela') out.push(...v.cabecalho, ...v.linhas.flat(), ...(v.total ?? []));
  if (v.tipo === 'lista') out.push(...v.itens);
  return out;
}

function semNumeroCru(deck: Deck) {
  for (const s of deck.slides) {
    for (const t of textos(s)) {
      expect(t, `${s.codigo}: ${t}`).not.toMatch(/NaN|undefined|null|Infinity|\d{4,}\.\d|\d\.\d{4,}|\d{5,}/);
    }
  }
}

describe('formato', () => {
  it('usa um formato único de valores', () => {
    expect(brl(44723.35)).toBe('R$ 44,7 mil');
    expect(brl(-10620)).toBe('−R$ 10,6 mil');
    expect(brl(324.2)).toBe('R$ 324,20');
    expect(brl(1_250_000)).toBe('R$ 1,3 mi');
    expect(mil(-2150, 0)).toBe('−2');
    expect(variacao(44723.35, 39638.71)).toBe('+12,8%');
    expect(variacao(1, 0)).toBeNull();
    expect(pct(57, 100)).toBe('57%');
    expect(pct(0.7, 100)).toBe('0,7%');
  });

  it('encurta razões sociais', () => {
    expect(nomeCurto('MANTIQUEIRA ALIMENTOS S.A.')).toBe('Mantiqueira');
    expect(nomeCurto('GLOBAL HATCH AVICULTURA LTDA.')).toBe('Global Hatch');
    expect(nomeCurto('JAGUAFRANGOS INDUSTRIA E COMERCIO DE ALIMENTOS LTDA')).toBe('Jaguafrangos');
    expect(nomeCurto('MAZZAFERRO IND. E COM. DE PRODUTOS PARA PESCA S/A')).toBe('Mazzaferro');
    expect(nomeCurto('BRF S.A.')).toBe('BRF');
    expect(nomeCurto('SSA')).toBe('SSA');
  });
});

describe('versões', () => {
  it('sugere trimestral em mar/jun/set e anual em dez', () => {
    expect(versaoSugerida('2026-01')).toBe('mensal');
    expect(versaoSugerida('2026-03')).toBe('trimestral');
    expect(versaoSugerida('2026-09')).toBe('trimestral');
    expect(versaoSugerida('2026-12')).toBe('anual');
    expect(versoesDisponiveis('2026-08')).toEqual(['mensal']);
    expect(versoesDisponiveis('2026-06')).toEqual(['trimestral', 'mensal']);
  });
});

describe('deck mensal', () => {
  const dados = dadosSinteticos('2026-08', { seguidores: true });
  const deck = montarDeck(dados, 'mensal', { geradoEm: GERADO });
  const base = new BaseFechamento(dados);

  it('tem os 11 slides fixos e os 2 condicionais', () => {
    expect(deck.slides.map((s) => s.codigo)).toEqual([
      'capa', 'resumo', 'faturamento', 'clientes', 'despesas', 'receita_despesa', 'caixa',
      'capital_giro', 'estoque', 'socios', 'pontos_atencao', 'mapa', 'redes',
    ]);
    expect(deck.rodape).toBe('Fechamento agosto/2026');
  });

  it('usa os mesmos números do Workbook', () => {
    const resumo = deck.slides.find((s) => s.codigo === 'resumo')!;
    if (resumo.visual.tipo !== 'kpis') throw new Error('kpis');
    const [fat, res, caixa] = resumo.visual.itens;
    expect(fat.valor).toBe(brl(base.fat('2026-08')));
    expect(res.valor).toBe(brl(base.rec('2026-08') - base.desp('2026-08')));
    expect(caixa.valor).toBe(brl(base.caixa('2026-08')));
    const ponte = deck.slides.find((s) => s.codigo === 'caixa')!.visual;
    if (ponte.tipo !== 'ponte') throw new Error('ponte');
    expect(ponte.passos.at(-1)!.valor).toBeCloseTo(base.caixa('2026-08'), 2);
  });

  it('não tem número sem formatação nem slide vazio', () => {
    semNumeroCru(deck);
    for (const s of deck.slides) {
      expect(s.mensagem.length, s.codigo).toBeGreaterThan(5);
      expect(s.comentarios.length, s.codigo).toBeLessThanOrEqual(3);
      if (s.visual.tipo !== 'capa' && s.visual.tipo !== 'lista') expect(s.comentarios.length, s.codigo).toBeGreaterThan(0);
    }
  });

  it('tira o slide quando falta o dado', () => {
    const d = montarDeck(dadosSinteticos('2026-08', { semDetalhe: true }), 'mensal', { geradoEm: GERADO });
    const codigos = d.slides.map((s) => s.codigo);
    expect(codigos).not.toContain('clientes');
    expect(codigos).not.toContain('despesas');
    expect(codigos).not.toContain('mapa');
    expect(codigos).not.toContain('redes');
  });
});

describe('deck trimestral e anual', () => {
  it('monta o trimestral (14 slides; aqui sem redes sociais)', () => {
    const deck = montarDeck(dadosSinteticos('2026-09'), 'trimestral', { geradoEm: GERADO });
    expect(deck.slides).toHaveLength(13); // sem redes sociais nos dados
    expect(deck.periodo).toBe('3º trimestre de 2026');
    const tres = deck.slides.find((s) => s.codigo === 'tres_meses')!.visual;
    if (tres.tipo !== 'tabela') throw new Error('tabela');
    expect(tres.cabecalho).toEqual(['', 'Jul', 'Ago', 'Set', '3º tri']);
    semNumeroCru(deck);
  });

  it('monta os 15 slides do anual', () => {
    const deck = montarDeck(dadosSinteticos('2026-12', { seguidores: true }), 'anual', { geradoEm: GERADO });
    expect(deck.slides.map((s) => s.codigo)).toEqual([
      'capa', 'resumo', 'acumulado_limite', 'faturamento_mensal', 'faturamento_trimestres', 'clientes', 'mapa',
      'despesas', 'resultado_mensal', 'caixa', 'capital_giro', 'socios', 'redes', 'destaques', 'metas',
    ]);
    semNumeroCru(deck);
  });
});

describe('alertas', () => {
  it('avisa quando o faturamento passa o limite da ME e quando um cliente concentra', () => {
    const base = new BaseFechamento(dadosSinteticos('2026-09', { limite: 100000 }));
    const a = calcularAlertas(base, { meses: ['2026-09'], sufixo: 'do mês' });
    expect(a.map((x) => x.codigo)).toEqual(expect.arrayContaining(['limite_me_100', 'concentracao_cliente', 'pagar_maior_receber_30d']));
    expect(a.find((x) => x.codigo === 'limite_me_100')!.texto).toMatch(/passou o limite da ME/);
  });

  it('não avisa limite abaixo de 80%', () => {
    const base = new BaseFechamento(dadosSinteticos('2026-02', { limite: 10_000_000 }));
    const a = calcularAlertas(base, { meses: ['2026-02'], sufixo: 'do mês' });
    expect(a.map((x) => x.codigo)).not.toContain('limite_me_100');
    expect(a.map((x) => x.codigo)).not.toContain('limite_me_80');
  });
});

describe('edições', () => {
  it('aplica título, comentários e slides ocultos', () => {
    const deck = montarDeck(dadosSinteticos('2026-08'), 'mensal', { geradoEm: GERADO });
    const e = aplicarEdicoes(deck, {
      faturamento: { mensagem: 'Título novo', comentarios: ['Um', '', 'Dois'] },
      estoque: { oculto: true },
      pontos_atencao: { itens: ['Item editado'] },
    });
    const fat = e.slides.find((s) => s.codigo === 'faturamento')!;
    expect(fat.mensagem).toBe('Título novo');
    expect(fat.comentarios).toEqual(['Um', 'Dois']);
    expect(e.slides.some((s) => s.codigo === 'estoque')).toBe(false);
    const pa = e.slides.find((s) => s.codigo === 'pontos_atencao')!.visual;
    expect(pa.tipo === 'lista' && pa.itens).toEqual(['Item editado']);
  });
});

describe('mapa e pptx', () => {
  it('tem os 27 estados', () => {
    expect(Object.keys(MAPA_BRASIL)).toHaveLength(27);
    const d = desenhar({ tipo: 'mapa', valores: { SP: 10, MG: 5 }, rotulo: '2026' })!;
    expect(d.formas.filter((f) => f.k === 'path')).toHaveLength(27);
  });

  it('gera o .pptx com os estados como formas editáveis', async () => {
    const deck = montarDeck(dadosSinteticos('2026-09'), 'trimestral', { geradoEm: GERADO });
    const buf = (await gerarPptx(deck, {}, 'nodebuffer')) as Uint8Array;
    const zip = await JSZip.loadAsync(buf);
    const slides = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
    expect(slides).toHaveLength(deck.slides.length);
    const iMapa = deck.slides.findIndex((s) => s.codigo === 'mapa') + 1;
    const xml = await zip.file(`ppt/slides/slide${iMapa}.xml`)!.async('string');
    expect((xml.match(/<a:custGeom>/g) ?? []).length).toBeGreaterThanOrEqual(27);
    expect(xml).toContain('Montserrat');
  });
});
