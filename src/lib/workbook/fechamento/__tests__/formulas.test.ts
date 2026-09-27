import { describe, expect, it } from 'vitest';
import { ErroExcel, avaliar, parsearFormula, type Escalar, type FonteCelulas, type Resultado } from '../formulas';

/** Planilha em memória: { aba: { A1: valor } }. */
function fonte(dados: Record<string, Record<string, Escalar>>): FonteCelulas {
  const col = (n: number) => String.fromCharCode(64 + n);
  return { valor: (aba, c, l) => dados[aba]?.[`${col(c)}${l}`] ?? null };
}

function calc(f: string, dados: Record<string, Record<string, Escalar>> = {}, aba = 'S'): Resultado {
  return avaliar(parsearFormula(f), aba, fonte(dados));
}

describe('avaliador de fórmulas do fechamento', () => {
  it('faz contas com referências de outras abas, com e sem aspas', () => {
    const d = { BASE: { E3: 15126.58 }, 'Faturamento FY': { G5: 2 } };
    expect(calc('BASE!$E$3/1000', d)).toBeCloseTo(15.12658);
    expect(calc("'Faturamento FY'!G5*(1+0.1)", d)).toBeCloseTo(2.2);
    expect(calc('-2^2')).toBe(4);
    expect(calc('10%')).toBe(0.1);
  });

  it('IF, IFERROR e comparações com célula vazia', () => {
    const d = { BASE: { B3: 1 } };
    expect(calc('IF(BASE!$B$3=1,"sim","")', d)).toBe('sim');
    expect(calc('IF(BASE!$B$4=1,"sim","")', d)).toBe('');
    expect(calc('IF(A1="",1,2)')).toBe(1);
    expect(calc('IFERROR(1/0,"x")')).toBe('x');
    expect(calc('1/0')).toBeInstanceOf(ErroExcel);
  });

  it('SUM e AVERAGE ignoram texto em faixas; AND e N', () => {
    const d = { S: { A1: 1, A2: 'texto', A3: 3, B1: true } };
    expect(calc('SUM(A1:A3,10)', d)).toBe(14);
    expect(calc('AVERAGE(A1:A3)', d)).toBe(2);
    expect(calc('AVERAGE(C1:C3)', d)).toBeInstanceOf(ErroExcel);
    expect(calc('AND(A1>0,B1)', d)).toBe(true);
    expect(calc('AND(A1>5,B1)', d)).toBe(false);
    expect(calc('N(A2)', d)).toBe(0);
    expect(calc('N(B1)', d)).toBe(1);
  });

  it('datas no sistema 1900: EOMONTH, YEAR e MONTH', () => {
    // 46023 = 01/01/2026
    expect(calc('EOMONTH(46023,0)')).toBe(46053);
    expect(calc('EOMONTH(46023,1)')).toBe(46081);
    expect(calc('EOMONTH(46023,-1)')).toBe(46022);
    expect(calc('YEAR(46266)')).toBe(2026);
    expect(calc('MONTH(46266)')).toBe(9);
  });

  it('VLOOKUP exato e aproximado', () => {
    const d = { S: { A1: 1, B1: 'Jan', A2: 2, B2: 'Fev', A3: 3, B3: 'Mar' } };
    expect(calc('VLOOKUP(2,$A$1:$B$3,2,0)', d)).toBe('Fev');
    expect(calc('VLOOKUP(2.5,$A$1:$B$3,2)', d)).toBe('Fev');
    expect(calc('VLOOKUP(9,$A$1:$B$3,2,0)', d)).toBeInstanceOf(ErroExcel);
  });

  it('LOOKUP(2,1/(...),faixa) devolve o último valor numérico diferente de zero', () => {
    const d = { S: { A1: 5, B1: 7, C1: 0, D1: 'x', E1: null } };
    expect(calc('IFERROR(LOOKUP(2,1/(ISNUMBER(A1:E1)*(A1:E1<>0)),A1:E1),0)', d)).toBe(7);
    expect(calc('IFERROR(LOOKUP(2,1/(ISNUMBER(C1:E1)*(C1:E1<>0)),C1:E1),0)', d)).toBe(0);
  });

  it('concatena números no formato geral', () => {
    expect(calc('"Receita "&2026')).toBe('Receita 2026');
    expect(calc('"x"&0.1+0.2')).toBe('x0.3');
  });

  it('função desconhecida vira #NAME?', () => {
    const r = calc('XLOOKUP(1,A1:A2,B1:B2)');
    expect(r).toBeInstanceOf(ErroExcel);
    expect((r as ErroExcel).codigo).toBe('#NAME?');
  });
});
