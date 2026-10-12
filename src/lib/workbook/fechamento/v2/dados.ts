/**
 * Monta o conteúdo da aba Dados do Workbook de Fechamento (modelo v2) a partir
 * de `apresentacao_fechamento_dados`, a mesma consulta da apresentação: deck e
 * planilha mostram os mesmos números.
 */
import type { ApresentacaoFechamentoDados } from '@/lib/apresentacao/fechamento/tipos';
import { NOME_ESTADO, mesAnoCurto, nomeCurto, nomeMes } from '@/lib/apresentacao/fechamento/formato';
import { excelSerial } from '../ooxml';
import {
  COL,
  COL_PARAMETRO,
  DEMAIS_CATEGORIAS,
  DETALHE_COLS,
  DETALHE_PRIMEIRA_LINHA,
  DETALHE_ULTIMA_LINHA,
  LINHAS_ABAS,
  LISTA,
  LISTA_PRIMEIRA_LINHA,
  MENSAL_MESES,
  MENSAL_PRIMEIRA_LINHA,
  PARAMETROS,
  PARAMETRO_PRIMEIRA_LINHA,
  VAGAS,
  type Parametro,
  type TipoDetalhe,
} from './layout';

export type ValorCelula = number | string | null;

export interface ConteudoDados {
  /** Células da aba Dados (ref -> valor). */
  celulas: Map<string, ValorCelula>;
  /** Linhas do detalhe (a partir de DETALHE_PRIMEIRA_LINHA). */
  linhasDetalhe: number;
  /** Linhas a esconder por aba (vagas vazias das listas). */
  ocultar: Record<string, number[]>;
}

/** Faixas do aging agrupadas como nas abas: a vencer até 30, 31–90, >90; vencido até 30, >30. */
const FAIXAS_AGING = [
  ['av_0_30'],
  ['av_31_60', 'av_61_90'],
  ['av_90p'],
  ['vc_0_30'],
  ['vc_31_60', 'vc_61_90', 'vc_91_120', 'vc_121_180', 'vc_181_360', 'vc_360p'],
] as const;

/** Nome de fornecedor legível: caixa normal quando vem todo em maiúsculas, sem cortar palavras. */
function nomeLegivel(nome: string): string {
  const t = nome.replace(/\s+/g, ' ').trim();
  if (t !== t.toLocaleUpperCase('pt-BR')) return t;
  return t
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|[\s/(-])(\p{L})/gu, (_m, s: string, c: string) => s + c.toLocaleUpperCase('pt-BR'))
    .replace(/\b(Ltda|S\/A|S\.A\.|Me|Epp|Eireli)\b\.?/g, (x) => x.toUpperCase());
}

function codigoUf(uf: string): string {
  return /^[A-Z]{2}$/.test(uf) ? uf : SEM_UF;
}

function intervalo(n: number, de: number): number[] {
  return Array.from({ length: n }, (_, i) => de + i);
}

/** UF dos clientes sem estado no cadastro ("??" seria curinga no SUMIFS do Excel). */
export const SEM_UF = 'S/UF';

/** O SUMIFS do Excel trata *, ? e ~ como curingas: os nomes das listas não podem tê-los. */
function semCuringa(s: string): string {
  return s.replace(/[*?~]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Nomes curtos e únicos para as listas (o SUMIFS das abas casa pelo nome). */
function nomesUnicos(chaves: string[], nomeDe: (k: string) => string): Map<string, string> {
  const out = new Map<string, string>();
  const usados = new Map<string, number>();
  for (const k of chaves) {
    let nome = semCuringa(nomeDe(k)) || semCuringa(k) || 'Sem nome';
    const base = nome.toLocaleLowerCase('pt-BR');
    const n = usados.get(base) ?? 0;
    usados.set(base, n + 1);
    if (n > 0) nome = `${nome} (${k})`;
    out.set(k, nome);
  }
  return out;
}

function ordenarPorAno(atual: Map<string, number>, anterior: Map<string, number>): string[] {
  const chaves = new Set([...atual.keys(), ...anterior.keys()]);
  return [...chaves]
    .filter((k) => (atual.get(k) ?? 0) !== 0 || (anterior.get(k) ?? 0) !== 0)
    .sort((a, b) => (atual.get(b) ?? 0) - (atual.get(a) ?? 0) || (anterior.get(b) ?? 0) - (anterior.get(a) ?? 0) || a.localeCompare(b));
}

function somar(m: Map<string, number>, k: string, v: number) {
  m.set(k, (m.get(k) ?? 0) + v);
}

function hoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function montarConteudoDados(dados: ApresentacaoFechamentoDados, geradoEm: string = hoje()): ConteudoDados {
  const wb = dados.workbook;
  const comp = dados.competencia;
  const [ano, mes] = comp.split('-').map(Number);
  if (wb.meses.length !== MENSAL_MESES) {
    throw new Error(`Workbook de Fechamento: esperados ${MENSAL_MESES} meses, recebidos ${wb.meses.length}.`);
  }
  const celulas = new Map<string, ValorCelula>();
  const set = (ref: string, v: ValorCelula | undefined) => {
    if (v === undefined || v === null || (typeof v === 'number' && !Number.isFinite(v))) return;
    celulas.set(ref, v);
  };
  const socios = wb.socios.slice(0, VAGAS.socios);

  // ── Tabela mensal ────────────────────────────────────────────────────────
  wb.meses.forEach((m, i) => {
    const r = MENSAL_PRIMEIRA_LINHA + i;
    const v = m.valores;
    set(`${COL.mes}${r}`, excelSerial(`${m.competencia}-01`));
    set(`${COL.rotulo}${r}`, mesAnoCurto(m.competencia));
    set(`${COL.fechado}${r}`, m.fechado ? 1 : 0);
    if (!m.fechado) return;
    const n = (x: number | undefined) => (x === undefined || x === null ? undefined : Number(x));
    set(`${COL.recebido}${r}`, n(v.receita_caixa) ?? 0);
    set(`${COL.pago}${r}`, n(v.despesa_caixa) ?? 0);
    set(`${COL.faturamento}${r}`, n(v.faturamento) ?? 0);
    set(`${COL.caixaFinal}${r}`, n(v.caixa_final));
    set(`${COL.caixaCalculado}${r}`, n(v.caixa_final_calculado) ?? n(v.caixa_final));
    set(`${COL.ajuste}${r}`, n(v.ajuste_caixa) ?? 0);
    set(`${COL.bloqueado}${r}`, n(v.bloqueado) ?? 0);
    set(`${COL.estoqueProdutos}${r}`, n(v.estoque_produtos) ?? 0);
    set(`${COL.estoqueMateriais}${r}`, n(v.estoque_materiais) ?? 0);
    FAIXAS_AGING.forEach((faixas, j) => {
      const soma = (pref: 'aging_cr_' | 'aging_cp_') =>
        faixas.reduce((s, f) => s + Number(v[`${pref}${f}` as keyof typeof v] ?? 0), 0);
      set(`${COL.receber[j]}${r}`, soma('aging_cr_'));
      set(`${COL.pagar[j]}${r}`, soma('aging_cp_'));
    });
    // Seguidores: vazio quando não informado (a aba Redes mostra "s/d").
    set(`${COL.linkedin}${r}`, n(v.seguidores_linkedin));
    set(`${COL.instagram}${r}`, n(v.seguidores_instagram));
    socios.forEach((s, k) => {
      const sm = m.socios?.[s.id];
      set(`${COL.retirada[k]}${r}`, Number(sm?.prolabore ?? 0));
      set(`${COL.atribuido[k]}${r}`, Number(sm?.saldo ?? 0));
    });
  });

  // ── Detalhe e listas ─────────────────────────────────────────────────────
  const meses = Object.keys(dados.detalhe ?? {}).filter((k) => k <= comp).sort();
  const doAno = (k: string, a: number) => k.startsWith(`${a}-`);
  const cliAtual = new Map<string, number>();
  const cliAnt = new Map<string, number>();
  const ufAtual = new Map<string, number>();
  const ufAnt = new Map<string, number>();
  const catAtual = new Map<string, number>();
  const catAnt = new Map<string, number>();
  for (const k of meses) {
    const d = dados.detalhe[k];
    const atual = doAno(k, ano);
    if (!atual && !doAno(k, ano - 1)) continue;
    for (const c of d.clientes ?? []) somar(atual ? cliAtual : cliAnt, c.k, Number(c.v));
    for (const [uf, v] of Object.entries(d.uf ?? {})) somar(atual ? ufAtual : ufAnt, codigoUf(uf), Number(v));
    for (const [cat, v] of Object.entries(d.despesas ?? {})) somar(atual ? catAtual : catAnt, semCuringa(cat), Number(v));
  }

  const clientes = ordenarPorAno(cliAtual, cliAnt);
  const nomeCliente = nomesUnicos(clientes, (k) => nomeCurto(dados.grupos?.[k] ?? 'Sem cliente'));
  const estados = ordenarPorAno(ufAtual, ufAnt).slice(0, VAGAS.estados);
  const categoriasTodas = ordenarPorAno(catAtual, catAnt);
  const categorias =
    categoriasTodas.length > VAGAS.categorias
      ? [...categoriasTodas.slice(0, VAGAS.categorias - 1), DEMAIS_CATEGORIAS]
      : categoriasTodas;
  const nomeCategoria = (c: string) => (categorias.includes(c) ? c : DEMAIS_CATEGORIAS);
  const fornecedoresMes = dados.detalhe?.[comp]?.fornecedores ?? [];
  const nomeFornecedor = nomesUnicos(
    fornecedoresMes.map((_, i) => String(i)),
    (i) => nomeLegivel(fornecedoresMes[Number(i)].nome),
  );

  clientes.slice(0, VAGAS.clientes).forEach((k, i) => {
    const r = LISTA_PRIMEIRA_LINHA + i;
    set(`${LISTA.cliente}${r}`, nomeCliente.get(k)!);
    const pc = dados.primeira_compra?.[k];
    if (pc) set(`${LISTA.primeiraCompra}${r}`, mesAnoCurto(pc));
  });
  estados.forEach((uf, i) => {
    const r = LISTA_PRIMEIRA_LINHA + i;
    set(`${LISTA.uf}${r}`, uf);
    set(`${LISTA.estado}${r}`, NOME_ESTADO[uf] ?? (uf === SEM_UF ? 'Sem estado no cadastro' : uf));
  });
  categorias.forEach((c, i) => set(`${LISTA.categoria}${LISTA_PRIMEIRA_LINHA + i}`, c));
  fornecedoresMes.slice(0, VAGAS.fornecedores).forEach((_, i) =>
    set(`${LISTA.fornecedor}${LISTA_PRIMEIRA_LINHA + i}`, nomeFornecedor.get(String(i))!),
  );

  let r = DETALHE_PRIMEIRA_LINHA;
  const linha = (k: string, tipo: TipoDetalhe, item: string, chave: string, valor: number, notas?: number) => {
    if (r > DETALHE_ULTIMA_LINHA) {
      throw new Error('Workbook de Fechamento: detalhe maior que o espaço do modelo.');
    }
    const [a, b, c, d, e, f, g] = DETALHE_COLS;
    set(`${a}${r}`, excelSerial(`${k}-01`));
    set(`${b}${r}`, mesAnoCurto(k));
    set(`${c}${r}`, tipo);
    set(`${d}${r}`, item);
    set(`${e}${r}`, chave);
    set(`${f}${r}`, Math.round(valor * 100) / 100);
    if (notas !== undefined) set(`${g}${r}`, notas);
    r++;
  };
  for (const k of meses) {
    const d = dados.detalhe[k];
    for (const c of d.clientes ?? []) {
      linha(k, 'Cliente', nomeCliente.get(c.k) ?? semCuringa(nomeCurto(dados.grupos?.[c.k] ?? c.k)), c.k, Number(c.v), c.nf);
    }
    const porUf = new Map<string, number>();
    for (const [uf, v] of Object.entries(d.uf ?? {})) somar(porUf, codigoUf(uf), Number(v));
    for (const [uf, v] of [...porUf].sort(([, a], [, b]) => b - a)) linha(k, 'Estado', uf, uf, v);
    const porCategoria = new Map<string, number>();
    for (const [cat, v] of Object.entries(d.despesas ?? {})) somar(porCategoria, nomeCategoria(semCuringa(cat)), Number(v));
    for (const [cat, v] of [...porCategoria].sort(([, a], [, b]) => b - a)) linha(k, 'Despesa', cat, cat, v);
    if (k === comp) {
      fornecedoresMes.forEach((fo, i) => linha(k, 'Fornecedor', nomeFornecedor.get(String(i))!, '', Number(fo.v)));
    } else {
      for (const fo of d.fornecedores ?? []) linha(k, 'Fornecedor', semCuringa(nomeLegivel(fo.nome)), '', Number(fo.v));
    }
  }

  // ── Parâmetros ───────────────────────────────────────────────────────────
  const param = (a: number) => wb.parametros?.[String(a)];
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const gruposNoAno = [...cliAtual.entries()].filter(([, v]) => v > 0).map(([k]) => k);
  const valores: Record<Parametro, ValorCelula | undefined> = {
    competencia: excelSerial(`${comp}-01`),
    mes,
    ano,
    periodo: `${nomeMes(comp)}/${ano}`,
    dataBase: excelSerial(`${comp}-${String(ultimoDia).padStart(2, '0')}`),
    geradoEm: excelSerial(geradoEm),
    metaAno: param(ano)?.crescimento_meta ?? 0,
    metaAnoAnterior: param(ano - 1)?.crescimento_meta ?? 0,
    limiteAno2: param(ano - 2)?.limite_faturamento ?? 0,
    limiteAno1: param(ano - 1)?.limite_faturamento ?? 0,
    limiteAno: param(ano)?.limite_faturamento ?? 0,
    extratoPendentes: dados.pendencias?.extrato_pendentes ?? 0,
    ultimoExtrato: dados.pendencias?.extrato_ultima_data ? excelSerial(dados.pendencias.extrato_ultima_data.slice(0, 10)) : null,
    notasSaida: dados.pendencias?.notas_saida_mes ?? 0,
    socio1: socios[0]?.nome_exibicao ?? null,
    socio2: socios[1]?.nome_exibicao ?? null,
    socio3: socios[2]?.nome_exibicao ?? null,
    socio4: socios[3]?.nome_exibicao ?? null,
    participacao1: socios[0] ? Number(socios[0].percentual) / 100 : null,
    participacao2: socios[1] ? Number(socios[1].percentual) / 100 : null,
    participacao3: socios[2] ? Number(socios[2].percentual) / 100 : null,
    participacao4: socios[3] ? Number(socios[3].percentual) / 100 : null,
    gruposNoAno: gruposNoAno.length,
    gruposNovos: gruposNoAno.filter((k) => (dados.primeira_compra?.[k] ?? '').startsWith(`${ano}-`)).length,
  };
  PARAMETROS.forEach((p, i) => set(`${COL_PARAMETRO}${PARAMETRO_PRIMEIRA_LINHA + i}`, valores[p]));

  // ── Linhas vazias a esconder ─────────────────────────────────────────────
  const vazias = (usadas: number, vagas: number, primeira: number) => intervalo(Math.max(0, vagas - usadas), primeira + usadas);
  const L = LINHAS_ABAS;
  const ocultar: Record<string, number[]> = {
    Clientes: [
      ...vazias(clientes.length, VAGAS.clientes, L.clientes.primeira),
      ...(clientes.length <= VAGAS.clientes ? [L.clientes.outros] : []),
    ],
    Estados: vazias(estados.length, VAGAS.estados, L.estados.primeira),
    Despesas: [
      ...vazias(categorias.length, VAGAS.categorias, L.despesas.primeira),
      ...vazias(Math.min(fornecedoresMes.length, VAGAS.fornecedores), VAGAS.fornecedores, L.despesas.fornecedores),
    ],
    'Sócios': [
      ...vazias(socios.length, VAGAS.socios, L.socios.retiradas),
      ...vazias(socios.length, VAGAS.socios, L.socios.atribuido),
    ],
  };

  return { celulas, linhasDetalhe: r - DETALHE_PRIMEIRA_LINHA, ocultar };
}
