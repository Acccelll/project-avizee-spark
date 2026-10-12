import { describe, expect, it } from 'vitest';
import { avisoSeguidores, lerInteiro, lerPercentual, lerReais, paraCampoInteiro, paraCampoReais, seguidoresAnteriores } from '../entradas';
import { dadosSinteticos } from './fixture';

const valor = (l: ReturnType<typeof lerReais>) => ('valor' in l ? l.valor : 'erro');

describe('entradas do fechamento', () => {
  it('lê reais com e sem separadores', () => {
    expect(valor(lerReais('124.240,82'))).toBe(124240.82);
    expect(valor(lerReais('R$ 4.314,12'))).toBe(4314.12);
    expect(valor(lerReais('124240.82'))).toBe(124240.82);
    expect(valor(lerReais('4.314'))).toBe(4314);
    expect(valor(lerReais(''))).toBeNull();
    expect(valor(lerReais('12a'))).toBe('erro');
  });

  it('seguidores: ponto é milhar e decimais são recusados', () => {
    expect(valor(lerInteiro('4.012'))).toBe(4012);
    expect(valor(lerInteiro('4012'))).toBe(4012);
    expect(valor(lerInteiro('4 012'))).toBe(4012);
    expect(valor(lerInteiro('4,012'))).toBe('erro');
    expect(valor(lerInteiro('40.12'))).toBe('erro');
  });

  it('percentual e formatação dos campos', () => {
    expect(valor(lerPercentual('8,5'))).toBe(0.085);
    expect(valor(lerPercentual('8.5%'))).toBe(0.085);
    expect(paraCampoReais(124240.82)).toBe('124.240,82');
    expect(paraCampoInteiro(4012)).toBe('4.012');
  });

  it('avisa variação estranha nos seguidores', () => {
    const dados = dadosSinteticos('2026-09', { seguidores: true });
    const ant = seguidoresAnteriores(dados, 'seguidores_linkedin');
    expect(ant?.competencia).toBe('2026-08');
    expect(avisoSeguidores(4, ant)).toMatch(/Caiu mais da metade/);
    expect(avisoSeguidores(ant!.valor + 10, ant)).toBeNull();
    expect(avisoSeguidores(ant!.valor * 4, ant)).toMatch(/triplicou/);
  });
});
