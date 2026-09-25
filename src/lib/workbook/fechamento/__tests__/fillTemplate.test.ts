import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import JSZip from 'jszip';
import { preencherWorkbookFechamento, definirTextoCelula } from '../fillTemplate';
import { buildBaseSheetXml, excelSerial } from '../baseSheet';
import { aplicarPlaceholders } from '../layout';
import { AGING_FAIXAS, type FechamentoDados, type FechamentoMes } from '../types';

const modelo = readFileSync(resolve(process.cwd(), 'public/workbook_fechamento_v1.xlsx'));

const SOCIOS = [
  { id: 's1', nome: 'ANA A', nome_exibicao: 'Ana A', percentual: 60 },
  { id: 's2', nome: 'BIA B', nome_exibicao: 'Bia B', percentual: 40 },
];

function dadosSinteticos(competencia: string): FechamentoDados {
  const ano = Number(competencia.slice(0, 4));
  const meses: FechamentoMes[] = [];
  const lista: string[] = [`${ano - 3}-12`];
  for (let a = ano - 2; a <= ano; a++) for (let m = 1; m <= 12; m++) lista.push(`${a}-${String(m).padStart(2, '0')}`);
  lista.forEach((c, i) => {
    const fechado = c <= competencia;
    const valores: FechamentoMes['valores'] = {};
    if (fechado) {
      valores.receita_caixa = 1000 + i;
      valores.despesa_caixa = 500 + i;
      valores.faturamento = 2000 + i;
      valores.bloqueado = 300;
      valores.estoque_materiais = 100;
      valores.estoque_produtos = 900;
      for (const f of AGING_FAIXAS) {
        valores[`aging_cr_${f}`] = 10;
        valores[`aging_cp_${f}`] = 20;
      }
      if (i % 2 === 0) valores.seguidores_linkedin = 3000 + i;
    }
    meses.push({
      competencia: c,
      fechado,
      valores,
      fontes: {},
      socios: fechado ? { s1: { saldo: 600, prolabore: 60 }, s2: { saldo: 400, prolabore: 40 } } : {},
    });
  });
  return {
    competencia,
    ano,
    saldo_caixa_anterior: 0,
    meses,
    socios: SOCIOS,
    parametros: { [String(ano)]: { crescimento_meta: 0.1, limite_faturamento: 360000 } },
  };
}

async function gerar(competencia: string) {
  const out = (await preencherWorkbookFechamento(modelo, dadosSinteticos(competencia), { tipo: 'uint8array' })) as Uint8Array;
  return JSZip.loadAsync(out);
}

async function parteDaAba(zip: JSZip, aba: string): Promise<string> {
  const wb = await zip.file('xl/workbook.xml')!.async('string');
  const rels = await zip.file('xl/_rels/workbook.xml.rels')!.async('string');
  const rid = new RegExp(`<sheet [^>]*name="${aba}"[^>]*r:id="([^"]+)"`).exec(wb)![1];
  const target = new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`).exec(rels)?.[1]
    ?? new RegExp(`Target="([^"]+)"[^>]*Id="${rid}"`).exec(rels)![1];
  return zip.file(`xl/${target}`)!.async('string');
}

describe('Workbook de Fechamento — modelo', () => {
  it('não carrega vínculos externos, tabelas dinâmicas nem cadeia de cálculo e recalcula ao abrir', async () => {
    const zip = await JSZip.loadAsync(modelo);
    const partes = Object.keys(zip.files);
    expect(partes.some((p) => p.includes('externalLink'))).toBe(false);
    expect(partes.some((p) => p.includes('pivot'))).toBe(false);
    expect(partes.some((p) => p.includes('calcChain'))).toBe(false);
    expect(partes.some((p) => p.includes('comments'))).toBe(false);
    const wb = await zip.file('xl/workbook.xml')!.async('string');
    expect(wb).toContain('fullCalcOnLoad="1"');
    expect(wb).toMatch(/name="BASE"[^>]*state="hidden"/);
    expect(partes.filter((p) => /^xl\/charts\/chart\d+\.xml$/.test(p)).length).toBe(11);
  });
});

describe('preencherWorkbookFechamento', () => {
  it('grava a BASE com 37 meses e zera os meses posteriores à competência', async () => {
    const zip = await gerar('2026-05');
    const base = await parteDaAba(zip, 'BASE');
    // Linha 2 = dez/2023; linha 31 = mai/2026 (fechado); linha 32 = jun/2026 (aberto).
    expect(base).toContain(`<c r="A2"><v>${excelSerial('2023-12-01')}</v></c>`);
    expect(base).toContain('<c r="B31"><v>1</v></c>');
    expect(base).toContain('<c r="B32"><v>0</v></c>');
    expect(base).not.toContain('<c r="C32">');
    expect(base).toContain('<c r="C31"><v>1029</v></c>');
    // Seguidores só quando informados (meses de índice par).
    expect(base).toContain('<c r="AE30"><v>3028</v></c>');
    expect(base).not.toContain('<c r="AE31">');
    // Parâmetros e sócios.
    expect(base).toContain('<c r="AQ4"><v>0.1</v></c>');
    expect(base).toContain('<t xml:space="preserve">Ana A</t>');
    expect(base).toContain('<c r="AQ12"><v>0.6</v></c>');
  });

  it('atualiza rótulos com o ano e mantém o estilo da célula', async () => {
    const zip = await gerar('2027-02');
    const conf = await parteDaAba(zip, 'Confronto');
    expect(conf).toMatch(/<c r="B12" s="\d+" t="inlineStr"><is><t xml:space="preserve">Receita 27<\/t><\/is><\/c>/);
    expect(conf).toContain('>Despesa 25<');
    expect(conf).toContain('>1Q26<');
    const fopag = await parteDaAba(zip, 'FOPAG');
    expect(fopag).toContain('>jan-27<');
    expect(fopag).toContain('>Saldo26<');
  });

  it('mantém os nomes das colunas das tabelas da FOPAG iguais aos cabeçalhos', async () => {
    const zip = await gerar('2027-02');
    const tabelas = await Promise.all(
      Object.keys(zip.files).filter((p) => /^xl\/tables\/table\d+\.xml$/.test(p)).map((p) => zip.file(p)!.async('string')),
    );
    const doAno = tabelas.find((t) => /ref="D25:/.test(t))!;
    expect(doAno).toContain('name="jan-27"');
    expect(doAno).toContain('name="Saldo27"');
    expect(doAno).not.toContain('name="jan-26"');
  });

  it('ajusta títulos e faixas dos gráficos à competência', async () => {
    const zip = await gerar('2026-05');
    const confronto = await zip.file('xl/charts/chart10.xml')!.async('string');
    expect(confronto).toContain('Confronto!$C$12:$G$12');
    expect(confronto).toContain('Confronto!$C$7:$G$7');
    expect(confronto).toContain('<a:t> 2025 x 2026</a:t>');
    const caixa = await zip.file('xl/charts/chart12.xml')!.async('string');
    // Jan/2026 é a linha 17 da Caixa Livre; maio -> linhas 10..21.
    expect(caixa).toContain("'Caixa Livre'!$J$10:$J$21");
    const estoque = await zip.file('xl/charts/chart24.xml')!.async('string');
    expect(estoque).toContain("'Estoque - Ativo'!$B$9:$B$20");
    const fopag = await zip.file('xl/charts/chart21.xml')!.async('string');
    expect(fopag).toContain('<a:t>FOPAG - mai/2026</a:t>');
  });
});

describe('utilitários', () => {
  it('troca placeholders de ano e mês', () => {
    expect(aplicarPlaceholders('Receita {YY-2} x {YYYY-1} {mmm}', { ano: 2026, mes: 3 })).toBe('Receita 24 x 2025 mar');
  });

  it('falha quando a célula não existe no modelo', () => {
    expect(() => definirTextoCelula('<sheetData></sheetData>', 'B2', 'x')).toThrow(/B2/);
  });

  it('exige os 37 meses', () => {
    const d = dadosSinteticos('2026-03');
    expect(() => buildBaseSheetXml({ ...d, meses: d.meses.slice(1) })).toThrow(/37 meses/);
  });

  it('escapa texto na BASE', () => {
    const d = dadosSinteticos('2026-03');
    const xml = buildBaseSheetXml({ ...d, socios: [{ ...SOCIOS[0], nome_exibicao: 'A & B <x>' }] });
    expect(xml).toContain('A &amp; B &lt;x&gt;');
  });
});
