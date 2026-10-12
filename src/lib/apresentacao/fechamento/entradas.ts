/**
 * Leitura e validação das entradas do fechamento digitadas na página: caixa
 * disponível do extrato, bloqueado em garantia, seguidores e parâmetros do ano.
 */
import type { ApresentacaoFechamentoDados } from './tipos';

export type Leitura = { ok: true; valor: number | null } | { ok: false; erro: string };

/** Ponto como milhar: "4.012", "124.240" (sem vírgula, grupos de 3 dígitos). */
const MILHAR = /^-?\d{1,3}(\.\d{3})+$/;

/**
 * Valor em reais: "124.240,82", "124240,82", "124240.82", "R$ 4.314,12".
 * Sem vírgula, ponto seguido de grupos de 3 dígitos é milhar ("4.314" = 4314).
 * Vazio = sem valor.
 */
export function lerReais(s: string): Leitura {
  let t = s.trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (t === '') return { ok: true, valor: null };
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (MILHAR.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  if (!/^-?\d+(\.\d+)?$/.test(t) || !Number.isFinite(n)) return { ok: false, erro: 'Use só números, como 124.240,82.' };
  return { ok: true, valor: Math.round(n * 100) / 100 };
}

/** Número inteiro: "4012", "4.012", "4 012". Vírgula ou casas decimais são recusadas. */
export function lerInteiro(s: string): Leitura {
  const t = s.trim();
  if (t === '') return { ok: true, valor: null };
  const limpo = t.replace(/\s/g, '');
  if (/^\d+$/.test(limpo)) return { ok: true, valor: Number(limpo) };
  if (MILHAR.test(limpo)) return { ok: true, valor: Number(limpo.replace(/\./g, '')) };
  return { ok: false, erro: 'Use um número inteiro, como 4.012.' };
}

/** Percentual digitado como "8,5" ou "8.5" → 0,085. */
export function lerPercentual(s: string): Leitura {
  const t = s.trim().replace('%', '').replace(',', '.');
  if (t === '') return { ok: true, valor: null };
  const n = Number(t);
  if (!Number.isFinite(n) || !/^-?\d+(\.\d+)?$/.test(t)) return { ok: false, erro: 'Use um percentual, como 8,5.' };
  return { ok: true, valor: Math.round(n * 100) / 10000 };
}

/** "124.240,82" para preencher o campo. */
export function paraCampoReais(v: number | null | undefined): string {
  if (v === null || v === undefined) return '';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function paraCampoInteiro(v: number | null | undefined): string {
  if (v === null || v === undefined) return '';
  return Math.round(v).toLocaleString('pt-BR');
}

/** Último valor informado de uma rede antes da competência. */
export function seguidoresAnteriores(
  dados: ApresentacaoFechamentoDados,
  rede: 'seguidores_linkedin' | 'seguidores_instagram',
): { competencia: string; valor: number } | null {
  const meses = dados.workbook.meses.filter((m) => m.competencia < dados.competencia && m.fechado);
  for (let i = meses.length - 1; i >= 0; i--) {
    const v = meses[i].valores[rede];
    if (v !== undefined && v !== null) return { competencia: meses[i].competencia, valor: Number(v) };
  }
  return null;
}

/** Aviso de variação estranha nos seguidores (não impede salvar). */
export function avisoSeguidores(valor: number | null, anterior: { valor: number } | null): string | null {
  if (valor === null || !anterior || anterior.valor <= 0) return null;
  if (valor < anterior.valor * 0.5) return `Caiu mais da metade (antes: ${anterior.valor.toLocaleString('pt-BR')}). Confira o número.`;
  if (valor > anterior.valor * 3) return `Mais que triplicou (antes: ${anterior.valor.toLocaleString('pt-BR')}). Confira o número.`;
  return null;
}
