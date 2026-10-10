/**
 * Slides que existem em mais de uma versão. Cada função devolve `null` quando
 * falta dado: o slide sai do deck em vez de aparecer vazio.
 */
import type { BaseFechamento } from './base';
import {
  NOME_ESTADO,
  brl,
  dataBr,
  fimDoMes,
  fimDoMesCurto,
  inteiro,
  mesAnoCurto,
  mesCurto,
  meses as mesesTxt,
  mil,
  nomeCurto,
  nomeMes,
  pct,
  porExtenso,
  porExtensoMaiusculo,
  reais,
  somarMeses,
  variacao,
} from './formato';
import { MAPA_BRASIL_CREDITO } from './mapaBrasil';
import type { Alerta, Slide } from './tipos';

export interface Periodo {
  meses: string[];
  /** Período anterior de mesmo tamanho (mês ou trimestre anterior, ano anterior). */
  anterior: string[];
  /** "setembro", "3º trimestre", "2026". */
  nome: string;
  /** "set", "3º tri", "2026". */
  curto: string;
  /** "do mês", "do trimestre", "do ano". */
  sufixo: string;
  /** "no mês", "no trimestre", "no ano". */
  no: string;
  /** Rótulo do período anterior: "ago", "2º tri", "2025". */
  anteriorCurto: string;
}

export const fonteWorkbook = (c: string) => `Workbook de Fechamento · ${mesAnoCurto(c)}`;

const soma = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

function plural(n: number, um: string, varios: string): string {
  return n === 1 ? um : varios;
}

/** "Mazzaferro 5,6 mil · Agrozootec 5,5 mil · CLC Cordas 4,0 mil". */
function listaValores(itens: Array<{ nome: string; v: number }>, n = 3): string {
  return itens.slice(0, n).map((x) => `${nomeCurto(x.nome)} ${mil(x.v)} mil`).join(' · ');
}

export function slideCapa(eyebrow: string, titulo: string, subtitulo: string, competencia: string, geradoEm: Date): Slide {
  return {
    codigo: 'capa',
    rotulo: 'Capa',
    mensagem: titulo,
    visual: {
      tipo: 'capa',
      eyebrow,
      titulo,
      subtitulo,
      rodape: `Data-base ${fimDoMes(competencia)} · gerado em ${dataBr(geradoEm)}`,
    },
    comentarios: [],
    fonte: '',
  };
}

export function slideClientes(base: BaseFechamento, p: Periodo, top = 5): Slide | null {
  const det = base.detalhe(p.meses);
  const total = soma(det.clientes.map((x) => x.v));
  if (!det.clientes.length || total <= 0) return null;
  const principais = det.clientes.slice(0, top);
  const resto = det.clientes.slice(top);
  const itens = principais.map((x) => ({ rotulo: nomeCurto(x.nome), valor: x.v, detalhe: `${brl(x.v)} · ${pct(x.v, total)}` }));
  if (resto.length) {
    const v = soma(resto.map((x) => x.v));
    itens.push({ rotulo: `Outros (${resto.length})`, valor: v, detalhe: `${brl(v)} · ${pct(v, total)}` });
  }
  const t1 = principais[0];
  const s1 = t1.v / total;
  const top3 = soma(principais.slice(0, 3).map((x) => x.v));
  const mensagem = s1 > 0.5
    ? `Um cliente concentrou mais da metade do faturamento ${p.sufixo}`
    : s1 > 0.3
      ? `${nomeCurto(t1.nome)} respondeu por ${pct(t1.v, total)} do faturamento ${p.sufixo}`
      : `Os três maiores clientes somam ${pct(top3, total)} do faturamento ${p.sufixo}`;
  const novos = base.novosClientes(p.meses);
  const comentarios = [
    `${inteiro(det.notas)} ${plural(det.notas, 'nota emitida', 'notas emitidas')} · ticket médio de ${brl(total / Math.max(det.notas, 1))}.`,
    `${nomeCurto(t1.nome)}: ${brl(t1.v)} em ${t1.nf} ${plural(t1.nf, 'nota', 'notas')}.`,
    novos.length
      ? `${porExtensoMaiusculo(novos.length)} ${plural(novos.length, 'cliente novo', 'clientes novos')} ${p.no}: ${novos.slice(0, 3).map((k) => nomeCurto(base.nomeGrupo(k))).join(', ')}${novos.length > 3 ? '…' : '.'}`
      : `Top 3 somam ${pct(top3, total)} ${p.sufixo}.`,
  ];
  return {
    codigo: 'clientes',
    rotulo: 'Clientes',
    mensagem,
    visual: { tipo: 'ranking', itens, cor: 'atual', destaques: 1 },
    comentarios,
    fonte: `Notas fiscais de saída · ${p.curto}`,
  };
}

export function slideDespesas(base: BaseFechamento, p: Periodo): Slide | null {
  const det = base.detalhe(p.meses);
  const total = soma(det.despesas.map((x) => x.v));
  if (total <= 0) return null;
  const principais = det.despesas.slice(0, 5);
  const resto = det.despesas.slice(5);
  const itens = principais.map((x) => ({ rotulo: x.nome, valor: x.v, detalhe: `${brl(x.v)} · ${pct(x.v, total)}` }));
  if (resto.length) {
    const v = soma(resto.map((x) => x.v));
    itens.push({ rotulo: `Outras (${resto.length})`, valor: v, detalhe: `${brl(v)} · ${pct(v, total)}` });
  }
  const t1 = principais[0];
  const desp = base.soma('despesa_caixa', p.meses);
  const despAnt = base.soma('despesa_caixa', p.anterior);
  const forn = det.fornecedores.filter((f) => !/^s[oó]cio\b/i.test(f.nome));
  const imp = det.despesas.find((x) => x.nome === 'Impostos e taxas');
  const varAnt = variacao(desp, despAnt, 0);
  return {
    codigo: 'despesas',
    rotulo: 'Despesas',
    mensagem: `${pct(t1.v, total)} dos pagamentos ${p.sufixo} foram ${t1.nome.toLocaleLowerCase('pt-BR')}`,
    visual: { tipo: 'ranking', itens, cor: 'despesa', destaques: 1 },
    comentarios: [
      `Despesa de caixa: ${brl(desp)}${varAnt ? ` (${varAnt} vs ${p.anteriorCurto})` : ''}.`,
      forn.length ? `Maiores pagamentos: ${listaValores(forn)}.` : null,
      imp ? `Impostos e taxas: ${brl(imp.v)}.` : `${porExtensoMaiusculo(det.despesas.length, true)} ${plural(det.despesas.length, 'categoria', 'categorias')} de despesa ${p.sufixo}.`,
    ].filter((x): x is string => !!x),
    fonte: `Pagamentos ${p.sufixo} por categoria`,
  };
}

/** Receita × despesa de caixa nos 12 meses terminados em `c`. */
export function slideReceitaDespesa(base: BaseFechamento, c: string): Slide {
  const l12 = base.ultimos12(c);
  const rec = l12.map((m) => base.rec(m));
  const desp = l12.map((m) => base.desp(m));
  const fechados = l12.filter((m) => base.fechado(m));
  const melhores = fechados.filter((m) => base.res(m) > 0).length;
  const melhor = [...fechados].sort((a, b) => base.res(b) - base.res(a))[0];
  const ytd = base.doAno(base.ano, Number(c.slice(5, 7)));
  const resYtd = soma(ytd.map((m) => base.res(m)));
  return {
    codigo: 'receita_despesa',
    rotulo: 'Receita × despesa',
    mensagem: melhores === fechados.length
      ? `Receita de caixa superou a despesa em todos os ${fechados.length} últimos meses`
      : `Receita de caixa superou a despesa em ${melhores} dos ${fechados.length} últimos meses`,
    visual: {
      tipo: 'barras',
      categorias: l12.map(mesAnoCurto),
      series: [
        { nome: 'Recebido', valores: rec, cor: 'atual' },
        { nome: 'Pago', valores: desp, cor: 'despesa' },
      ],
      destaque: l12.length - 1,
    },
    comentarios: [
      `${nomeMes(c).charAt(0).toUpperCase() + nomeMes(c).slice(1)}: recebido ${brl(base.rec(c))} · pago ${brl(base.desp(c))}.`,
      `Acumulado ${base.ano}: resultado de caixa de ${brl(resYtd)}.`,
      melhor ? `Melhor resultado em 12 meses: ${mesAnoCurto(melhor)} (${brl(base.res(melhor))}).` : null,
    ].filter((x): x is string => !!x),
    fonte: `Regime de caixa · ${fonteWorkbook(c)}`,
  };
}

function mesesEmAlta(base: BaseFechamento, c: string): number {
  let n = 0;
  for (let m = c; base.fechado(somarMeses(m, -1)) && base.caixa(m) > base.caixa(somarMeses(m, -1)); m = somarMeses(m, -1)) n++;
  return n;
}

/** Caixa: 12 meses e a ponte do período (mês, trimestre ou ano). */
export function slideCaixa(base: BaseFechamento, p: Periodo, c: string): Slide {
  const l12 = base.ultimos12(c);
  const serie = l12.map((m) => base.caixa(m));
  const ini = somarMeses(p.meses[0], -1);
  const caixaIni = base.caixa(ini);
  const caixaFim = base.caixa(c);
  const rec = base.soma('receita_caixa', p.meses);
  const desp = base.soma('despesa_caixa', p.meses);
  const ajuste = base.soma('ajuste_caixa', p.meses);
  const passos: Array<{ rotulo: string; valor: number; tipo: 'base' | 'entrada' | 'saida' }> = [
    { rotulo: `Caixa em ${fimDoMesCurto(ini)}`, valor: caixaIni, tipo: 'base' },
    { rotulo: 'Recebimentos', valor: rec, tipo: 'entrada' },
    { rotulo: 'Pagamentos', valor: -desp, tipo: 'saida' },
  ];
  if (Math.abs(ajuste) >= 1) passos.push({ rotulo: 'Ajuste ao extrato', valor: ajuste, tipo: ajuste > 0 ? 'entrada' : 'saida' });
  passos.push({ rotulo: `Caixa em ${fimDoMesCurto(c)}`, valor: caixaFim, tipo: 'base' });

  const fechados = l12.filter((m) => base.fechado(m));
  const max = Math.max(...fechados.map((m) => base.caixa(m)));
  const min = Math.min(...fechados.map((m) => base.caixa(m)));
  const delta = caixaFim - caixaIni;
  const umMes = p.meses.length === 1;
  let mensagem: string;
  if (!umMes && caixaIni > 0 && caixaFim >= 2 * caixaIni) {
    mensagem = `O caixa dobrou ${p.no}: de ${brl(caixaIni)} para ${brl(caixaFim)}`;
  } else if (fechados.length >= 6 && caixaFim >= max) {
    mensagem = `O caixa fechou em ${brl(caixaFim)}, o maior saldo dos últimos 12 meses`;
  } else if (fechados.length >= 6 && caixaFim <= min) {
    mensagem = `O caixa fechou em ${brl(caixaFim)}, o menor saldo dos últimos 12 meses`;
  } else {
    mensagem = `O caixa ${delta >= 0 ? 'subiu' : 'caiu'} ${brl(Math.abs(delta))} ${p.no} e fechou em ${brl(caixaFim)}`;
  }

  const alta = mesesEmAlta(base, c);
  const minMes = [...fechados].sort((a, b) => base.caixa(a) - base.caixa(b))[0];
  const bloq = base.bloqueado(c);
  const comentarios: string[] = umMes
    ? [
        `Entrou ${brl(rec)} e saiu ${brl(desp)} no mês.`,
        alta >= 2
          ? `${alta}º mês seguido de alta; desde ${mesCurto(minMes)} o caixa cresceu ${brl(caixaFim - base.caixa(minMes))}.`
          : `Variação em 12 meses: ${brl(caixaFim - base.caixa(somarMeses(c, -12)))}.`,
        bloq != null && bloq > 0 ? `Valor bloqueado em garantias: ${brl(bloq)}.` : 'Valor bloqueado em garantias: não informado neste mês.',
      ]
    : [
        `Recebido ${brl(rec)} · pago ${brl(desp)}.`,
        `Média de ${brl((rec - desp) / p.meses.length)} de resultado por mês.`,
        desp > 0 ? `Caixa cobre ${mesesTxt(caixaFim / (desp / p.meses.length))} da despesa média ${p.sufixo}.` : `Caixa em ${fimDoMesCurto(c)}: ${brl(caixaFim)}.`,
      ];
  return {
    codigo: 'caixa',
    rotulo: 'Caixa',
    mensagem,
    visual: { tipo: 'ponte', passos, serie: { categorias: l12.map(mesAnoCurto), valores: serie } },
    comentarios,
    fonte: `Caixa do fechamento · ${fonteWorkbook(c)}`,
  };
}

export function slideCapitalGiro(base: BaseFechamento, c: string, extra?: string): Slide | null {
  const cr = base.aging(c, 'cr');
  const cp = base.aging(c, 'cp');
  if (cr.total <= 0 && cp.total <= 0) return null;
  const saldo = cr.total - cp.total;
  const caixa = base.caixa(c);
  return {
    codigo: 'capital_giro',
    rotulo: 'Capital de giro',
    mensagem: cp.ate30 > cr.ate30
      ? 'Há mais a pagar do que a receber nos próximos 30 dias'
      : 'O que entra em 30 dias cobre o que vence a pagar',
    visual: { tipo: 'aging', receber: cr.faixas, pagar: cp.faixas },
    comentarios: [
      `A receber: ${brl(cr.total)}, vencido ${brl(cr.vencido)} (${pct(cr.vencido, cr.total)}).`,
      `A pagar: ${brl(cp.total)} · ${brl(cp.ate30)} vencem em até 30 dias.`,
      `Saldo de giro: ${brl(saldo)}${saldo < 0 && caixa >= -saldo ? ', coberto pelo caixa' : ''}.`,
      extra ?? null,
    ].filter((x): x is string => !!x).slice(0, 3),
    fonte: `Contas a receber e a pagar em ${fimDoMesCurto(c)}`,
  };
}

export function slideEstoque(base: BaseFechamento, c: string): Slide | null {
  const l12 = base.ultimos12(c);
  const est = l12.map((m) => base.estoque(m));
  if (est.every((e) => e.total <= 0)) return null;
  const atual = base.estoque(c);
  const ant = base.estoque(somarMeses(c, -1));
  const delta = atual.total - ant.total;
  const ytd = base.doAno(base.ano, Number(c.slice(5, 7)));
  const fatMedio = soma(ytd.map((m) => base.fat(m))) / ytd.length;
  const doAno = ytd.map((m) => ({ m, v: base.estoque(m).total }));
  const maior = [...doAno].sort((a, b) => b.v - a.v)[0];
  return {
    codigo: 'estoque',
    rotulo: 'Estoque',
    mensagem: Math.abs(delta) < 1
      ? `Estoque estável em ${brl(atual.total)}`
      : `Estoque ${delta > 0 ? 'subiu' : 'caiu'} ${brl(Math.abs(delta))} e fechou em ${brl(atual.total)}`,
    visual: {
      tipo: 'barras',
      categorias: l12.map(mesAnoCurto),
      series: [
        { nome: 'Produtos', valores: est.map((e) => e.produtos), cor: 'atual' },
        { nome: 'Materiais', valores: est.map((e) => e.materiais), cor: 'despesa' },
      ],
      destaque: l12.length - 1,
      empilhado: true,
    },
    comentarios: [
      `Produtos ${brl(atual.produtos)} · materiais ${brl(atual.materiais)}.`,
      fatMedio > 0 ? `Equivale a ${mesesTxt(atual.total / fatMedio)} do faturamento médio de ${base.ano}.` : null,
      maior && maior.m !== c ? `Maior nível do ano: ${mesCurto(maior.m)} (${brl(maior.v)}).` : `É o maior nível de ${base.ano}.`,
    ].filter((x): x is string => !!x),
    fonte: `Posição de estoque a custo · ${fonteWorkbook(c)}`,
  };
}

export function slideSocios(base: BaseFechamento, p: Periodo, c: string): Slide | null {
  const socios = base.socios();
  if (!socios.length) return null;
  const ytd = base.doAno(base.ano, Number(c.slice(5, 7)));
  const umMes = p.meses.length === 1;
  const linhas = socios
    .slice()
    .sort((a, b) => b.percentual - a.percentual)
    .map((s) => {
      const pl = soma(p.meses.map((m) => base.socioMes(m, s.id).prolabore));
      const saldo = base.socioMes(c, s.id).saldo;
      return { s, pl, saldo };
    });
  const totPl = soma(linhas.map((l) => l.pl));
  const totSaldo = soma(linhas.map((l) => l.saldo));
  const porMes = ytd.map((m) => soma(socios.map((s) => base.socioMes(m, s.id).prolabore)));
  const estavel = porMes.length > 1 && porMes.every((v) => Math.abs(v - porMes[0]) < 0.01);
  const plAno = soma(porMes);
  return {
    codigo: 'socios',
    rotulo: 'Sócios',
    mensagem: estavel
      ? `Pró-labore estável; saldo dos sócios soma ${brl(totSaldo)} no ano`
      : `Pró-labore de ${reais(totPl)} ${p.no}; saldo dos sócios soma ${brl(totSaldo)} no ano`,
    visual: {
      tipo: 'tabela',
      cabecalho: ['Sócio', 'Part.', umMes ? 'Pró-labore' : `Pró-labore ${p.curto}`, `Saldo ${base.ano}`],
      linhas: linhas.map((l) => [l.s.nome_exibicao, `${inteiro(l.s.percentual)}%`, reais(l.pl), brl(l.saldo)]),
      total: ['Total', `${inteiro(soma(socios.map((s) => s.percentual)))}%`, reais(totPl), brl(totSaldo)],
    },
    comentarios: [
      'Saldo = resultado de caixa do ano × participação.',
      estavel ? `Pró-labore igual nos ${porExtenso(porMes.length)} meses de ${base.ano}.` : `Pró-labore no ano: ${brl(plAno)}.`,
      estavel ? `Pró-labore no ano: ${brl(plAno)}.` : null,
    ].filter((x): x is string => !!x),
    fonte: `Sócios · ${fonteWorkbook(c)}`,
  };
}

export function slidePontosAtencao(alertas: Alerta[], c: string, codigo = 'pontos_atencao', rotulo = 'Pontos de atenção', quando = `em ${nomeMes(somarMeses(c, 1))}`): Slide | null {
  if (!alertas.length) return null;
  const itens = alertas.slice(0, 4).map((a) => `${a.titulo} ${a.texto}`);
  const n = itens.length;
  return {
    codigo,
    rotulo,
    mensagem: `${porExtensoMaiusculo(n)} ${plural(n, 'assunto', 'assuntos')} para decidir ${quando}`,
    visual: { tipo: 'lista', itens },
    comentarios: [],
    fonte: 'Regras de alerta do fechamento',
  };
}

function ufs(valores: Record<string, number>): Array<[string, number]> {
  return Object.entries(valores).filter(([k, v]) => k !== '??' && v > 0).sort((a, b) => b[1] - a[1]);
}

/** Mapa do Brasil por UF do cliente. `anterior` adiciona o mapa do período anterior. */
export function slideMapa(base: BaseFechamento, p: Periodo, anterior?: Periodo): Slide | null {
  const valores = base.detalhe(p.meses).uf;
  const lista = ufs(valores);
  if (lista.length < 2) return null;
  const total = soma(lista.map(([, v]) => v));
  const [e1, v1] = lista[0];
  const [e2, v2] = lista[1];
  const mensagem = v1 / total >= 0.5
    ? `${NOME_ESTADO[e1] ?? e1} concentrou ${pct(v1, total)} das vendas ${p.sufixo}`
    : (v1 + v2) / total >= 0.6
      ? `${NOME_ESTADO[e1] ?? e1} e ${NOME_ESTADO[e2] ?? e2} somam ${pct(v1 + v2, total)} das vendas ${p.sufixo}`
      : `${porExtensoMaiusculo(lista.length)} estados com venda ${p.no}; ${NOME_ESTADO[e1] ?? e1} lidera com ${pct(v1, total)}`;
  const ant = anterior ? ufs(base.detalhe(anterior.meses).uf) : [];
  const comentarios = [
    anterior && ant.length
      ? `${lista.length} estados com venda ${p.no}, contra ${ant.length} em ${anterior.curto}.`
      : `${lista.length} estados com venda ${p.no}.`,
    `${e1}: ${brl(v1)} · ${e2}: ${brl(v2)}.`,
    'Quanto mais escuro o estado, maior a fatia do faturamento.',
  ];
  return {
    codigo: 'mapa',
    rotulo: 'Vendas por estado',
    mensagem,
    visual: {
      tipo: 'mapa',
      valores: Object.fromEntries(lista),
      rotulo: p.curto,
      anterior: anterior && ant.length ? { rotulo: anterior.curto, valores: Object.fromEntries(ant) } : undefined,
    },
    comentarios,
    fonte: `Notas de saída por UF do cliente · ${p.curto} · ${MAPA_BRASIL_CREDITO.replace('Contornos', 'contornos')}`,
  };
}

/** Seguidores nos 12 meses terminados em `c`; null sem dado no período. */
export function slideRedes(base: BaseFechamento, c: string): Slide | null {
  const ultimo = base.ultimoMesSeguidores(c);
  if (!ultimo || ultimo < somarMeses(c, -11)) return null;
  const l12 = base.ultimos12(ultimo);
  const li = l12.map((m) => (base.tem(m, 'seguidores_linkedin') ? base.v(m, 'seguidores_linkedin') : null));
  const ig = l12.map((m) => (base.tem(m, 'seguidores_instagram') ? base.v(m, 'seguidores_instagram') : null));
  const ult = (xs: Array<number | null>) => [...xs].reverse().find((x) => x != null) ?? null;
  const pri = (xs: Array<number | null>) => xs.find((x) => x != null) ?? null;
  const liU = ult(li), liP = pri(li), igU = ult(ig), igP = pri(ig);
  const parado = (xs: Array<number | null>) => {
    const vs = xs.filter((x): x is number => x != null);
    let n = 0;
    for (let i = vs.length - 1; i > 0 && vs[i] <= vs[i - 1]; i--) n++;
    return n;
  };
  const partes: string[] = [];
  if (liU != null) partes.push(`LinkedIn chegou a ${inteiro(liU)} seguidores`);
  if (igU != null) partes.push(parado(ig) >= 2 ? `Instagram parou em ${inteiro(igU)}` : `Instagram chegou a ${inteiro(igU)}`);
  const comentarios: string[] = [];
  if (liU != null && liP) comentarios.push(`LinkedIn: ${liU - liP >= 0 ? '+' : '−'}${inteiro(Math.abs(liU - liP))} seguidores em 12 meses (${variacao(liU, liP, 0)}).`);
  if (igU != null && igP) {
    comentarios.push(parado(ig) >= 2
      ? `Instagram sem crescer há ${porExtenso(parado(ig))} meses.`
      : `Instagram: ${igU - igP >= 0 ? '+' : '−'}${inteiro(Math.abs(igU - igP))} seguidores em 12 meses.`);
  }
  if (ultimo < c) comentarios.push(`Dados até ${mesAnoCurto(ultimo)}: ${mesCurto(somarMeses(ultimo, 1))}–${mesAnoCurto(c)} não foram informados.`);
  return {
    codigo: 'redes',
    rotulo: 'Redes sociais',
    mensagem: partes.join('; '),
    visual: {
      tipo: 'redes',
      categorias: l12.map(mesAnoCurto),
      series: [
        { nome: 'LinkedIn', valores: li, cor: 'atual' },
        { nome: 'Instagram', valores: ig, cor: 'despesa' },
      ],
    },
    comentarios: comentarios.slice(0, 3),
    fonte: 'Seguidores informados no fechamento',
  };
}

export const somaMeses = soma;
