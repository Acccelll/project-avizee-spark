/**
 * Acesso aos números do fechamento. Os agregados (faturamento, caixa, aging,
 * estoque, sócios) vêm só do Workbook; o detalhe por cliente, UF e categoria
 * só reparte esses totais.
 */
import type { FechamentoMetrica } from '@/lib/workbook/fechamento/types';
import { ano, intervaloMeses, mes, somarMeses } from './formato';
import type { ApresentacaoFechamentoDados, FaixaAging, VersaoApresentacao } from './tipos';

/** Versão que o mês fechado pede: trimestral em mar/jun/set, anual em dez. */
export function versaoSugerida(competencia: string): VersaoApresentacao {
  const m = mes(competencia);
  if (m === 12) return 'anual';
  if (m % 3 === 0) return 'trimestral';
  return 'mensal';
}

/** A sugerida primeiro; a mensal sempre pode ser gerada. */
export function versoesDisponiveis(competencia: string): VersaoApresentacao[] {
  const s = versaoSugerida(competencia);
  return s === 'mensal' ? ['mensal'] : [s, 'mensal'];
}

export const NOME_VERSAO: Record<VersaoApresentacao, string> = {
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  anual: 'Anual',
};

/** Último mês fechado: o mês anterior ao de `hoje`. */
export function ultimoMesFechado(hoje = new Date()): string {
  const c = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  return somarMeses(c, -1);
}

export interface ClienteAgregado {
  k: string;
  nome: string;
  v: number;
  nf: number;
}

export interface DetalheAgregado {
  clientes: ClienteAgregado[];
  uf: Record<string, number>;
  despesas: Array<{ nome: string; v: number }>;
  fornecedores: Array<{ nome: string; v: number }>;
  notas: number;
}

export class BaseFechamento {
  readonly competencia: string;
  readonly ano: number;
  private readonly meses = new Map<string, ApresentacaoFechamentoDados['workbook']['meses'][number]>();

  constructor(readonly dados: ApresentacaoFechamentoDados) {
    this.competencia = dados.competencia;
    this.ano = ano(dados.competencia);
    for (const m of dados.workbook.meses ?? []) this.meses.set(m.competencia, m);
  }

  /** Mês fechado e coberto pelo Workbook. */
  fechado(c: string): boolean {
    return !!this.meses.get(c)?.fechado && c <= this.competencia;
  }

  tem(c: string, metrica: FechamentoMetrica): boolean {
    const v = this.meses.get(c)?.valores?.[metrica];
    return this.fechado(c) && typeof v === 'number';
  }

  v(c: string, metrica: FechamentoMetrica): number {
    if (!this.fechado(c)) return 0;
    const v = this.meses.get(c)?.valores?.[metrica];
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  }

  fonte(c: string, metrica: FechamentoMetrica): string | undefined {
    return this.meses.get(c)?.fontes?.[metrica];
  }

  fat(c: string): number { return this.v(c, 'faturamento'); }
  rec(c: string): number { return this.v(c, 'receita_caixa'); }
  desp(c: string): number { return this.v(c, 'despesa_caixa'); }
  res(c: string): number { return this.rec(c) - this.desp(c); }
  caixa(c: string): number { return this.v(c, 'caixa_final'); }

  soma(metrica: FechamentoMetrica, meses: string[]): number {
    return meses.reduce((s, c) => s + this.v(c, metrica), 0);
  }

  /** Meses de jan até o mês `m` do ano `a` (inclusive). */
  doAno(a: number, ateMes = 12): string[] {
    return intervaloMeses(`${a}-01`, `${a}-${String(ateMes).padStart(2, '0')}`);
  }

  /** Meses do trimestre `t` do ano `a`. */
  doTrimestre(a: number, t: number): string[] {
    const ini = `${a}-${String((t - 1) * 3 + 1).padStart(2, '0')}`;
    return intervaloMeses(ini, somarMeses(ini, 2));
  }

  /** Os 12 meses terminados em `c`. */
  ultimos12(c = this.competencia): string[] {
    return intervaloMeses(somarMeses(c, -11), c);
  }

  limite(a = this.ano): number {
    return this.dados.workbook.parametros?.[String(a)]?.limite_faturamento ?? 0;
  }

  metaCrescimento(a = this.ano): number | null {
    const v = this.dados.workbook.parametros?.[String(a)]?.crescimento_meta;
    return typeof v === 'number' ? v : null;
  }

  nomeGrupo(k: string): string {
    return this.dados.grupos?.[k] ?? 'Sem cliente';
  }

  /** Detalhe somado de vários meses. Meses fora da janela do detalhe são ignorados. */
  detalhe(meses: string[]): DetalheAgregado {
    const cli = new Map<string, ClienteAgregado>();
    const uf: Record<string, number> = {};
    const desp: Record<string, number> = {};
    const forn: Record<string, number> = {};
    let notas = 0;
    for (const c of meses) {
      const d = this.fechado(c) ? this.dados.detalhe?.[c] : undefined;
      if (!d) continue;
      for (const x of d.clientes ?? []) {
        const a = cli.get(x.k) ?? { k: x.k, nome: this.nomeGrupo(x.k), v: 0, nf: 0 };
        a.v += x.v;
        a.nf += x.nf;
        notas += x.nf;
        cli.set(x.k, a);
      }
      for (const [k, v] of Object.entries(d.uf ?? {})) uf[k] = (uf[k] ?? 0) + v;
      for (const [k, v] of Object.entries(d.despesas ?? {})) desp[k] = (desp[k] ?? 0) + v;
      for (const x of d.fornecedores ?? []) forn[x.nome] = (forn[x.nome] ?? 0) + x.v;
    }
    const ord = <T extends { v: number }>(a: T[]) => a.sort((x, y) => y.v - x.v);
    return {
      clientes: ord([...cli.values()]),
      uf,
      despesas: ord(Object.entries(desp).map(([nome, v]) => ({ nome, v }))),
      fornecedores: ord(Object.entries(forn).map(([nome, v]) => ({ nome, v }))),
      notas,
    };
  }

  /** Grupos de cliente cuja primeira nota caiu em um dos meses. */
  novosClientes(meses: string[]): string[] {
    const set = new Set(meses);
    return Object.entries(this.dados.primeira_compra ?? {})
      .filter(([k, c]) => set.has(c) && k !== 'sem-cliente')
      .map(([k]) => k);
  }

  aging(c: string, tipo: 'cr' | 'cp'): { faixas: FaixaAging[]; total: number; vencido: number; ate30: number } {
    const g = (f: string) => this.v(c, `aging_${tipo}_${f}` as FechamentoMetrica);
    const ate30 = g('av_0_30');
    const f3190 = g('av_31_60') + g('av_61_90');
    const f90 = g('av_90p');
    const vencido = ['vc_0_30', 'vc_31_60', 'vc_61_90', 'vc_91_120', 'vc_121_180', 'vc_181_360', 'vc_360p'].reduce((s, f) => s + g(f), 0);
    const faixas: FaixaAging[] = [
      { rotulo: 'A vencer até 30 dias', valor: ate30, nivel: 0 },
      { rotulo: '31 a 90 dias', valor: f3190, nivel: 1 },
      { rotulo: 'Mais de 90 dias', valor: f90, nivel: 2 },
      { rotulo: 'Vencido', valor: vencido, nivel: 3 },
    ];
    return { faixas, total: ate30 + f3190 + f90 + vencido, vencido, ate30 };
  }

  estoque(c: string): { produtos: number; materiais: number; total: number } {
    const produtos = this.v(c, 'estoque_produtos');
    const materiais = this.v(c, 'estoque_materiais');
    return { produtos, materiais, total: produtos + materiais };
  }

  /** Último mês até `c` com seguidores informados, se houver. */
  ultimoMesSeguidores(c = this.competencia): string | null {
    for (let x = c; x >= somarMeses(c, -24); x = somarMeses(x, -1)) {
      if (this.tem(x, 'seguidores_linkedin') || this.tem(x, 'seguidores_instagram')) return x;
    }
    return null;
  }

  /** Bloqueado informado no fechamento do mês (null se não informado). */
  bloqueado(c: string): number | null {
    return this.fonte(c, 'bloqueado') ? this.v(c, 'bloqueado') : null;
  }

  socios(): ApresentacaoFechamentoDados['workbook']['socios'] {
    return this.dados.workbook.socios ?? [];
  }

  socioMes(c: string, id: string): { saldo: number; prolabore: number } {
    const s = this.fechado(c) ? this.meses.get(c)?.socios?.[id] : undefined;
    return { saldo: s?.saldo ?? 0, prolabore: s?.prolabore ?? 0 };
  }
}
