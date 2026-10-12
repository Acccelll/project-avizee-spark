import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import JSZip from 'jszip';
import { dadosSinteticos } from '@/lib/apresentacao/fechamento/__tests__/fixture';
import { excelSerial } from '../ooxml';
import { montarConteudoDados } from '../v2/dados';
import { escreverCelulas, mapaAbas, ocultarLinhas, preencherWorkbookFechamentoV2 } from '../v2/preencher';

const modelo = readFileSync(resolve(process.cwd(), 'public/workbook_fechamento_v2.xlsx'));

async function abrir(competencia = '2026-09', opts: Parameters<typeof dadosSinteticos>[1] = { seguidores: true }) {
  const dados = dadosSinteticos(competencia, opts);
  const out = (await preencherWorkbookFechamentoV2(modelo, dados, { tipo: 'uint8array', geradoEm: '2026-10-12' })) as Uint8Array;
  const zip = await JSZip.loadAsync(out);
  const abas = await mapaAbas(zip);
  const xml = async (aba: string) => zip.file(abas.get(aba)!)!.async('string');
  return { dados, zip, abas, xml };
}

/** Valor gravado numa célula (cache da fórmula ou valor). */
function valor(xml: string, ref: string): string | number | null {
  const m = new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>([\\s\\S]*?)</c>)`).exec(xml);
  if (!m) return null;
  const interno = m[2] ?? '';
  const v = /<v>([\s\S]*?)<\/v>/.exec(interno)?.[1];
  const t = /<t[^>]*>([\s\S]*?)<\/t>/.exec(interno)?.[1];
  if (/t="(str|inlineStr|e)"/.test(m[1])) return v ?? t ?? null;
  return v === undefined ? null : Number(v);
}

describe('Workbook de Fechamento v2', () => {
  it('o modelo tem as 12 abas na ordem do plano', async () => {
    const zip = await JSZip.loadAsync(modelo);
    expect([...(await mapaAbas(zip)).keys()]).toEqual([
      'Resumo', 'Resultado', 'Faturamento', 'Caixa', 'Despesas', 'Clientes', 'Estados',
      'Capital de giro', 'Estoque', 'Sócios', 'Redes', 'Dados',
    ]);
  });

  it('preenche a aba Dados e calcula as abas a partir dela', async () => {
    const { dados, xml } = await abrir();
    const d = await xml('Dados');
    expect(valor(d, 'A5')).toBe(excelSerial('2023-12-01'));
    expect(valor(d, 'B38')).toBe('set/26');
    expect(valor(d, 'C38')).toBe(1);
    expect(valor(d, 'C39')).toBe(0);
    const set = dados.workbook.meses.find((m) => m.competencia === '2026-09')!;
    expect(valor(d, 'F38')).toBeCloseTo(set.valores.faturamento!);

    const resumo = await xml('Resumo');
    expect(valor(resumo, 'B6')).toBeCloseTo(set.valores.faturamento!);
    // Conferências: clientes, estados e categorias batem com o mês.
    expect(valor(resumo, 'F19')).toBe('OK');
    expect(valor(resumo, 'F20')).toBe('OK');
    expect(valor(resumo, 'F21')).toBe('OK');

    const resultado = await xml('Resultado');
    expect(valor(resultado, 'K5')).toBeCloseTo(set.valores.receita_caixa!);
    expect(valor(resultado, 'L5')).toBe(''); // outubro: mês futuro vazio

    const clientes = await xml('Clientes');
    expect(valor(clientes, 'B5')).toBe('Cliente Principal');
    expect(valor(clientes, 'Q5')).toBe('A');
  });

  it('todas as fórmulas ficam com valor calculado', async () => {
    const { zip, abas } = await abrir();
    for (const [aba, path] of abas) {
      const x = await zip.file(path)!.async('string');
      const semValor = [...x.matchAll(/<c r="([A-Z]+\d+)"[^>]*>(<f>[^<]*<\/f>)(?!<v>)/g)].map((m) => m[1]);
      expect(semValor, aba).toEqual([]);
      expect(x.includes('#NAME?'), aba).toBe(false);
    }
  });

  it('esconde as vagas vazias das listas', async () => {
    const { xml } = await abrir();
    const clientes = await xml('Clientes');
    // 4 grupos no fixture: linhas 9..44 e "Outros" (45) ocultas.
    expect(/<row r="9"[^>]*hidden="1"/.test(clientes)).toBe(true);
    expect(/<row r="45"[^>]*hidden="1"/.test(clientes)).toBe(true);
    expect(/<row r="8"[^>]*hidden="1"/.test(clientes)).toBe(false);
    const socios = await xml('Sócios');
    expect(/<row r="8"[^>]*hidden="1"/.test(socios)).toBe(true);
    expect(/<row r="7"[^>]*hidden="1"/.test(socios)).toBe(false);
  });

  it('nomes sem curingas do SUMIFS e UF vazia como S/UF', () => {
    const dados = dadosSinteticos('2026-09');
    dados.grupos['11111111'] = 'CLIENTE * ESTRELA?';
    dados.detalhe['2026-09'].uf['??'] = 10;
    const c = montarConteudoDados(dados, '2026-10-12');
    const nomes = [...c.celulas.entries()].filter(([k]) => /^AK\d+$/.test(k)).map(([, v]) => v);
    expect(nomes.some((n) => typeof n === 'string' && /[*?~]/.test(n))).toBe(false);
    const ufs = [...c.celulas.entries()].filter(([k]) => /^AN\d+$/.test(k)).map(([, v]) => v);
    expect(ufs).toContain('S/UF');
  });

  it('com mais de 4 sócios, a última vaga soma os demais', () => {
    const dados = dadosSinteticos('2026-09');
    const extras = ['s3', 's4', 's5'].map((id, i) => ({ id, nome: `S${i}`, nome_exibicao: `Sócio ${id}`, percentual: 0 }));
    dados.workbook.socios = [...dados.workbook.socios, ...extras];
    const set = dados.workbook.meses.find((m) => m.competencia === '2026-09')!;
    for (const id of ['s3', 's4', 's5']) set.socios[id] = { saldo: 10, prolabore: 5 };
    const c = montarConteudoDados(dados, '2026-10-12');
    expect(c.celulas.get('AI22')).toBe('Demais sócios (2)');
    expect(c.celulas.get('AB38')).toBe(10); // retirada: s4 + s5
    expect(c.celulas.get('AF38')).toBe(20); // resultado atribuído: s4 + s5
  });

  it('escreverCelulas preserva o estilo e herda o da linha modelo', () => {
    const xml = '<worksheet><dimension ref="A1:B2"/><sheetData><row r="2"><c r="A2" s="5"/><c r="B2" s="7"/></row></sheetData></worksheet>';
    const out = escreverCelulas(xml, new Map<string, string | number | null>([['A2', 10], ['B3', 'x']]), 2);
    expect(out).toContain('<c r="A2" s="5"><v>10</v></c>');
    expect(out).toContain('<c r="B3" s="7" t="inlineStr">');
    expect(out).toContain('<dimension ref="A1:B3"/>');
    expect(ocultarLinhas(out, [3])).toContain('<row r="3" hidden="1">');
  });
});
