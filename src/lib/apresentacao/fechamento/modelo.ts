/**
 * Monta o deck de fechamento (mensal, trimestral ou anual) a partir de
 * `apresentacao_fechamento_dados`. O resultado é um modelo neutro: o gerador
 * .pptx e a prévia da página desenham o mesmo conteúdo.
 */
import { calcularAlertas, mesQueCruzouLimite } from './alertas';
import { BaseFechamento } from './base';
import {
  ano as anoDe,
  brl,
  fimDoMesCurto,
  mesAnoCurto,
  mesCurto,
  mil,
  nomeCurto,
  nomeMes,
  nomeMesMaiusculo,
  nomeTrimestre,
  numero,
  pct,
  porExtensoMaiusculo,
  somarMeses,
  trimestre,
  variacao,
  vezes,
} from './formato';
import {
  type Periodo,
  fonteWorkbook,
  slideCapa,
  slideCapitalGiro,
  slideCaixa,
  slideClientes,
  slideDespesas,
  slideEstoque,
  slideMapa,
  slidePontosAtencao,
  slideReceitaDespesa,
  slideRedes,
  slideSocios,
  somaMeses as soma,
} from './slidesComuns';
import type { ApresentacaoFechamentoDados, Deck, EdicoesDeck, Kpi, Slide, VersaoApresentacao } from './tipos';

export interface OpcoesDeck {
  /** Data de geração mostrada na capa (padrão: agora). */
  geradoEm?: Date;
}

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const ok = <T,>(xs: Array<T | null | undefined | false | 0 | ''>): T[] => xs.filter((x): x is T => !!x);

/** "2,7 vezes setembro de 2025", "+12% sobre setembro de 2025". */
function comparacao(atual: number, base: number, alvo: string): string {
  if (base <= 0) return '';
  const r = atual / base;
  if (r >= 2) return `${vezes(atual, base).replace('×', ' vezes')} ${alvo}`;
  return `${variacao(atual, base, 0)} ${r >= 1 ? 'sobre' : 'contra'} ${alvo}`;
}

function periodoMes(c: string): Periodo {
  const p = somarMeses(c, -1);
  return { meses: [c], anterior: [p], nome: nomeMes(c), curto: mesAnoCurto(c), sufixo: 'do mês', no: 'no mês', anteriorCurto: mesCurto(p) };
}

function periodoTrimestre(base: BaseFechamento, a: number, t: number): Periodo {
  const pa = t === 1 ? a - 1 : a;
  const pt = t === 1 ? 4 : t - 1;
  return {
    meses: base.doTrimestre(a, t),
    anterior: base.doTrimestre(pa, pt),
    nome: nomeTrimestre(t, true),
    curto: `${nomeTrimestre(t)}/${String(a).slice(2)}`,
    sufixo: 'do trimestre',
    no: 'no trimestre',
    anteriorCurto: nomeTrimestre(pt),
  };
}

function periodoAno(base: BaseFechamento, a: number, ateMes = 12): Periodo {
  return {
    meses: base.doAno(a, ateMes),
    anterior: base.doAno(a - 1, ateMes),
    nome: String(a),
    curto: String(a),
    sufixo: 'do ano',
    no: 'no ano',
    anteriorCurto: String(a - 1),
  };
}

function limiteTexto(base: BaseFechamento, c: string): string | null {
  const limite = base.limite();
  if (!limite) return null;
  const ytd = base.soma('faturamento', base.doAno(base.ano, Number(c.slice(5, 7))));
  const cruzou = mesQueCruzouLimite(base, base.ano, c, limite);
  if (cruzou) return `Limite da ME ultrapassado em ${nomeMes(cruzou)}: avaliar enquadramento.`;
  if (ytd / limite >= 0.8) return `${pct(ytd, limite)} do limite da ME usado até ${mesCurto(c)}.`;
  return `Restam ${brl(limite - ytd)} até o limite da ME.`;
}

// ---------------------------------------------------------------- mensal ----

function resumoMensal(base: BaseFechamento, c: string): Slide {
  const p = somarMeses(c, -1);
  const y = somarMeses(c, -12);
  const fat = base.fat(c);
  const ytd = base.soma('faturamento', base.doAno(base.ano, Number(c.slice(5, 7))));
  const limite = base.limite();
  const uso = limite ? ytd / limite : 0;
  const l12 = base.ultimos12(c).filter((m) => base.fechado(m));
  const caixa = base.caixa(c);
  const recordeCaixa = l12.length >= 6 && caixa >= Math.max(...l12.map((m) => base.caixa(m)));
  const recordeFat = l12.length >= 6 && fat >= Math.max(...l12.map((m) => base.fat(m)));
  let alta = 0;
  for (let m = c; base.fechado(somarMeses(m, -1)) && base.caixa(m) > base.caixa(somarMeses(m, -1)); m = somarMeses(m, -1)) alta++;

  const positivos = ok([recordeCaixa && 'caixa recorde', recordeFat && 'faturamento recorde', base.res(c) > 0 && `resultado de caixa de ${brl(base.res(c))}`]);
  const negativos = ok([
    uso >= 1 && 'o faturamento do ano passou o limite da ME',
    uso >= 0.8 && uso < 1 && `o faturamento do ano já usa ${pct(ytd, limite)} do limite da ME`,
    base.res(c) < 0 && `resultado de caixa negativo de ${brl(-base.res(c))}`,
  ]);
  const mensagem = positivos.length && negativos.length
    ? `Mês com ${positivos[0]}, mas ${negativos[0]}`
    : positivos.length
      ? `Mês com ${positivos.slice(0, 2).join(' e ')}`
      : negativos.length
        ? `Atenção: ${negativos[0]}`
        : `Faturamento de ${brl(fat)} e resultado de caixa de ${brl(base.res(c))}`;

  const itens: Kpi[] = [
    {
      rotulo: 'Faturamento',
      valor: brl(fat),
      detalhe: ok([variacao(fat, base.fat(p)) && `${variacao(fat, base.fat(p))} vs ${mesCurto(p)}`, base.fat(y) > 0 && `${vezes(fat, base.fat(y))} ${mesAnoCurto(y)}`]).join(' · '),
    },
    { rotulo: 'Resultado de caixa', valor: brl(base.res(c)), detalhe: `receitas ${mil(base.rec(c))} − despesas ${mil(base.desp(c))}` },
    {
      rotulo: 'Caixa no fim do mês',
      valor: brl(caixa),
      detalhe: `${caixa - base.caixa(p) >= 0 ? '+' : '−'}${mil(Math.abs(caixa - base.caixa(p)))} mil no mês${alta >= 2 ? ` · ${alta}º mês em alta` : ''}`,
    },
  ];
  if (limite) itens.push({ rotulo: 'Faturamento acumulado', valor: brl(ytd), detalhe: `${pct(ytd, limite)} do limite anual da ME`, alerta: uso >= 0.8 });

  const alertas = calcularAlertas(base, { meses: [c], sufixo: 'do mês' });
  const comentarios = ok([
    ...alertas.slice(0, 2).map((a) => a.texto),
    alta >= 2 ? `Caixa subiu pelo ${alta}º mês seguido e fechou em ${brl(caixa)}.` : `Caixa fechou em ${brl(caixa)}.`,
  ]).slice(0, 3);
  return { codigo: 'resumo', rotulo: 'Resumo do mês', mensagem, visual: { tipo: 'kpis', itens }, comentarios, fonte: fonteWorkbook(c) };
}

function faturamentoMensal(base: BaseFechamento, c: string): Slide {
  const m = Number(c.slice(5, 7));
  const a = base.ano;
  const atual = base.doAno(a, m);
  const ant = base.doAno(a - 1, m);
  const fat = base.fat(c);
  const p = somarMeses(c, -1);
  const y = somarMeses(c, -12);
  const ytd = soma(atual.map((x) => base.fat(x)));
  const ytdAnt = soma(ant.map((x) => base.fat(x)));
  const cmp = base.fat(y) > 0 ? comparacao(fat, base.fat(y), `${nomeMes(y)} de ${a - 1}`) : comparacao(fat, base.fat(p), nomeMes(p));
  const limite = base.limite();
  return {
    codigo: 'faturamento',
    rotulo: 'Faturamento',
    mensagem: `${nomeMesMaiusculo(c)} faturou ${brl(fat)}${cmp ? `, ${cmp}` : ''}`,
    visual: {
      tipo: 'barras',
      categorias: MESES_CURTOS.slice(0, m),
      series: [
        { nome: String(a - 1), valores: ant.map((x) => base.fat(x)), cor: 'anterior' },
        { nome: String(a), valores: atual.map((x) => base.fat(x)), cor: 'atual' },
      ],
      destaque: m - 1,
      limite: limite ? { usado: ytd, limite, rotulo: `Acumulado ${a}` } : undefined,
    },
    comentarios: ok([
      variacao(fat, base.fat(p)) && `${variacao(fat, base.fat(p))} sobre ${mesCurto(p)} (${brl(base.fat(p))}).`,
      `Acumulado ${a}: ${brl(ytd)}${ytdAnt > 0 ? `, ${variacao(ytd, ytdAnt, 0)} sobre o mesmo período de ${a - 1}` : ''}.`,
      limiteTexto(base, c),
    ]),
    fonte: `Notas fiscais emitidas · ${fonteWorkbook(c)}`,
  };
}

function deckMensal(base: BaseFechamento, c: string, geradoEm: Date): Slide[] {
  const per = periodoMes(c);
  const anoAte = periodoAno(base, base.ano, Number(c.slice(5, 7)));
  const alertas = calcularAlertas(base, { meses: [c], sufixo: 'do mês' });
  const mapa = slideMapa(base, anoAte, periodoAno(base, base.ano - 1, 12));
  // No mensal, um mapa só (o do ano); o ano anterior entra no comentário.
  if (mapa && mapa.visual.tipo === 'mapa') mapa.visual = { ...mapa.visual, anterior: undefined };
  return ok([
    slideCapa('Fechamento mensal', `${nomeMesMaiusculo(c)} de ${base.ano}`, 'Resultados financeiros, caixa e capital de giro', c, geradoEm),
    resumoMensal(base, c),
    faturamentoMensal(base, c),
    slideClientes(base, per),
    slideDespesas(base, per),
    slideReceitaDespesa(base, c),
    slideCaixa(base, per, c),
    slideCapitalGiro(base, c),
    slideEstoque(base, c),
    slideSocios(base, per, c),
    slidePontosAtencao(alertas, c),
    mapa,
    slideRedes(base, c),
  ]);
}

// ------------------------------------------------------------ trimestral ----

function trimestres(base: BaseFechamento, a: number, ate: string, metrica: 'faturamento' | 'resultado'): Array<number | null> {
  return [1, 2, 3, 4].map((t) => {
    const ms = base.doTrimestre(a, t);
    if (ms[0] > ate) return null;
    const dentro = ms.filter((m) => m <= ate);
    return metrica === 'faturamento' ? soma(dentro.map((m) => base.fat(m))) : soma(dentro.map((m) => base.res(m)));
  });
}

function deckTrimestral(base: BaseFechamento, c: string, geradoEm: Date): Slide[] {
  const a = base.ano;
  const t = trimestre(c);
  const per = periodoTrimestre(base, a, t);
  const Q = per.meses;
  const Qp = per.anterior;
  const Qy = base.doTrimestre(a - 1, t);
  const fatQ = soma(Q.map((m) => base.fat(m)));
  const fatQp = soma(Qp.map((m) => base.fat(m)));
  const fatQy = soma(Qy.map((m) => base.fat(m)));
  const recQ = base.soma('receita_caixa', Q);
  const despQ = base.soma('despesa_caixa', Q);
  const resQ = recQ - despQ;
  const despQp = base.soma('despesa_caixa', Qp);
  const ytd = soma(base.doAno(a, Number(c.slice(5, 7))).map((m) => base.fat(m)));
  const ytdAnt = soma(base.doAno(a - 1, Number(c.slice(5, 7))).map((m) => base.fat(m)));
  const anoAntInteiro = soma(base.doAno(a - 1).map((m) => base.fat(m)));
  const resTris = trimestres(base, a, c, 'resultado');
  const melhorTri = resTris.every((r) => r == null || r <= resQ + 0.005);
  const caixaIni = base.caixa(somarMeses(Q[0], -1));
  const caixa = base.caixa(c);
  const det = base.detalhe(Q);
  const novos = base.novosClientes(Q);
  const totalCli = soma(det.clientes.map((x) => x.v));
  const tAnt = nomeTrimestre(t === 1 ? 4 : t - 1);

  const pos = ok([melhorTri && t > 1 && `Melhor trimestre de caixa do ano`, fatQ > fatQp && `Faturamento ${variacao(fatQ, fatQp, 0)} sobre o ${tAnt}`]);
  const neg = ok([fatQ < fatQp && `faturamento abaixo do ${nomeTrimestre(t === 1 ? 4 : t - 1, true)}`, resQ < 0 && `resultado de caixa negativo`]);
  const mensagemResumo = pos.length && neg.length
    ? `${pos[0]}, com ${neg[0]}`
    : pos.length
      ? pos[0]
      : neg.length
        ? `Trimestre com ${neg[0]}`
        : `Trimestre com faturamento de ${brl(fatQ)}`;

  const resumo: Slide = {
    codigo: 'resumo',
    rotulo: 'Resumo do trimestre',
    mensagem: mensagemResumo,
    visual: {
      tipo: 'kpis',
      itens: [
        { rotulo: 'Faturamento do tri', valor: brl(fatQ), detalhe: ok([variacao(fatQ, fatQp) && `${variacao(fatQ, fatQp)} vs ${tAnt}`, fatQy > 0 && `${vezes(fatQ, fatQy)} ${nomeTrimestre(t)}/${String(a - 1).slice(2)}`]).join(' · ') },
        { rotulo: 'Resultado de caixa', valor: brl(resQ), detalhe: melhorTri && t > 1 ? `melhor trimestre de ${a}` : `recebido ${mil(recQ)} − pago ${mil(despQ)}` },
        { rotulo: `Caixa em ${fimDoMesCurto(c)}`, valor: brl(caixa), detalhe: `${caixa - caixaIni >= 0 ? '+' : '−'}${mil(Math.abs(caixa - caixaIni))} mil no trimestre` },
        { rotulo: 'Clientes', valor: `${det.clientes.length} atendidos`, detalhe: `${novos.length} com a 1ª compra no trimestre` },
      ],
    },
    comentarios: ok([
      anoAntInteiro > 0 && ytd > anoAntInteiro
        ? `Acumulado do ano já é ${variacao(ytd, anoAntInteiro, 0)?.replace('+', '')} maior que todo o ano de ${a - 1}.`
        : `Acumulado do ano: ${brl(ytd)}${ytdAnt ? ` (${variacao(ytd, ytdAnt, 0)} sobre ${a - 1})` : ''}.`,
      limiteTexto(base, c),
      det.clientes[0] && totalCli > 0 && `${nomeCurto(det.clientes[0].nome)} respondeu por ${pct(det.clientes[0].v, totalCli)} do trimestre.`,
    ]),
    fonte: fonteWorkbook(c),
  };

  const res = Q.map((m) => base.res(m));
  const iMelhor = res.indexOf(Math.max(...res));
  const tresMeses: Slide = {
    codigo: 'tres_meses',
    rotulo: 'Os três meses',
    mensagem: iMelhor === 2
      ? `${nomeMesMaiusculo(Q[2])} fechou o trimestre com o maior resultado de caixa`
      : `${nomeMesMaiusculo(Q[iMelhor])} teve o maior resultado de caixa do trimestre`,
    visual: {
      tipo: 'tabela',
      cabecalho: ['', ...Q.map((m) => nomeMesMaiusculo(m).slice(0, 3)), nomeTrimestre(t)],
      linhas: [
        ['Faturamento', ...Q.map((m) => mil(base.fat(m))), mil(fatQ)],
        ['Recebido', ...Q.map((m) => mil(base.rec(m))), mil(recQ)],
        ['Pago', ...Q.map((m) => mil(base.desp(m))), mil(despQ)],
        ['Resultado de caixa', ...res.map((v) => mil(v)), mil(resQ)],
      ],
      total: ['Caixa no fim', ...Q.map((m) => mil(base.caixa(m))), mil(caixa)],
      nota: 'Valores em R$ mil.',
    },
    comentarios: ok([
      res[0] < res[1] && res[1] < res[2] ? 'Resultado cresceu nos três meses seguidos.' : `Faturamento médio de ${brl(fatQ / 3)} por mês.`,
      variacao(despQ, despQp, 0) && `Pagamentos ${variacao(despQ, despQp, 0)} contra o ${tAnt}.`,
      `Recebimentos ${recQ >= fatQ ? 'superaram o' : 'ficaram abaixo do'} faturamento em ${brl(Math.abs(recQ - fatQ))}.`,
    ]),
    fonte: fonteWorkbook(c),
  };

  const fTri = trimestres(base, a, c, 'faturamento');
  const fTriAnt = trimestres(base, a - 1, `${a - 1}-12`, 'faturamento');
  const meta = base.metaCrescimento();
  const fatTri: Slide = {
    codigo: 'faturamento_trimestres',
    rotulo: 'Faturamento por trimestre',
    mensagem: fatQy > 0
      ? `${nomeTrimestre(t, true)} faturou ${fatQ / fatQy >= 2 ? `${vezes(fatQ, fatQy).replace('×', ' vezes')} o mesmo trimestre de ${a - 1}` : `${brl(fatQ)}, ${variacao(fatQ, fatQy, 0)} sobre o mesmo trimestre de ${a - 1}`}`
      : `${nomeTrimestre(t, true)} faturou ${brl(fatQ)}`,
    visual: {
      tipo: 'barras',
      categorias: [1, 2, 3, 4].map((x) => nomeTrimestre(x)),
      series: [
        { nome: String(a - 1), valores: fTriAnt, cor: 'anterior' },
        { nome: String(a), valores: fTri, cor: 'atual' },
      ],
      destaque: t - 1,
    },
    comentarios: ok([
      `Acumulado do ano: ${brl(ytd)}${ytdAnt ? ` (${variacao(ytd, ytdAnt, 0)} sobre o mesmo período de ${a - 1})` : ''}.`,
      variacao(fatQ, fatQp, 1) && `${variacao(fatQ, fatQp, 1)} contra o ${tAnt} (${brl(fatQp)}).`,
      meta != null && ytdAnt > 0 && `Meta de crescimento do ano: ${numero(meta * 100, 1)}% · realizado: ${variacao(ytd, ytdAnt, 0)}.`,
    ]),
    fonte: `Notas fiscais emitidas · trimestres`,
  };

  const resTriAnt = trimestres(base, a - 1, `${a - 1}-12`, 'resultado');
  const resultadoTri: Slide = {
    codigo: 'resultado_trimestres',
    rotulo: 'Resultado de caixa por trimestre',
    mensagem: melhorTri && t > 1
      ? `Resultado de caixa de ${brl(resQ)}, o melhor trimestre de ${a}`
      : `Resultado de caixa de ${brl(resQ)} no trimestre`,
    visual: {
      tipo: 'barras',
      categorias: [1, 2, 3, 4].map((x) => nomeTrimestre(x)),
      series: [
        { nome: String(a - 1), valores: resTriAnt, cor: 'anterior' },
        { nome: String(a), valores: resTris, cor: 'atual' },
      ],
      destaque: t - 1,
    },
    comentarios: ok([
      `Recebido ${brl(recQ)} · pago ${brl(despQ)}.`,
      `Acumulado ${a}: ${brl(soma(resTris.map((x) => x ?? 0)))} de resultado de caixa.`,
      resTriAnt[t - 1] != null && `Mesmo trimestre de ${a - 1}: ${brl(resTriAnt[t - 1] ?? 0)}.`,
    ]),
    fonte: `Regime de caixa · ${fonteWorkbook(c)}`,
  };

  const alertas = calcularAlertas(base, { meses: Q, sufixo: 'do trimestre' });
  const metas = slidePontosAtencao(alertas, c, 'metas', 'Metas e próximo trimestre', `no ${nomeTrimestre(t + 1 > 4 ? 1 : t + 1, true)}`);
  if (metas) metas.mensagem = metas.mensagem.replace(/assuntos? para decidir/, (s) => (s.startsWith('assuntos') ? 'decisões para' : 'decisão para')).replace(' para no ', ' para o ');

  return ok([
    slideCapa('Fechamento trimestral', `${nomeTrimestre(t, true)} de ${a}`, Q.map((m, i) => (i === 0 ? nomeMesMaiusculo(m) : nomeMes(m))).join(', ').replace(/, ([^,]+)$/, ' e $1'), c, geradoEm),
    resumo,
    tresMeses,
    fatTri,
    slideClientes(base, per),
    slideMapa(base, per),
    slideDespesas(base, per),
    resultadoTri,
    slideCaixa(base, per, c),
    slideCapitalGiro(base, c),
    slideEstoque(base, c),
    slideSocios(base, per, c),
    slideRedes(base, c),
    metas,
  ]);
}

// ----------------------------------------------------------------- anual ----

function deckAnual(base: BaseFechamento, c: string, geradoEm: Date): Slide[] {
  const a = base.ano;
  const ate = Number(c.slice(5, 7));
  const per = periodoAno(base, a, ate);
  const perAnt = periodoAno(base, a - 1, 12);
  const M = per.meses;
  const fat = soma(M.map((m) => base.fat(m)));
  const fatAnt = soma(base.doAno(a - 1, ate).map((m) => base.fat(m)));
  const rec = base.soma('receita_caixa', M);
  const desp = base.soma('despesa_caixa', M);
  const caixa = base.caixa(c);
  const caixaIni = base.caixa(`${a - 1}-12`);
  const det = base.detalhe(M);
  const totalCli = soma(det.clientes.map((x) => x.v));
  const novos = base.novosClientes(M);
  const meta = base.metaCrescimento();
  const limite = base.limite();
  const crescimento = fatAnt > 0 ? fat / fatAnt - 1 : null;
  const melhorMes = [...M].sort((x, y) => base.fat(y) - base.fat(x))[0];

  const numeros: Slide = {
    codigo: 'resumo',
    rotulo: 'O ano em números',
    mensagem: fatAnt > 0 ? `${a} faturou ${brl(fat)}, ${comparacao(fat, fatAnt, String(a - 1))}` : `${a} faturou ${brl(fat)}`,
    visual: {
      tipo: 'kpis',
      itens: ok<Kpi>([
        { rotulo: 'Faturamento do ano', valor: brl(fat), detalhe: variacao(fat, fatAnt) ? `${variacao(fat, fatAnt)} vs ${a - 1}` : '' },
        { rotulo: 'Resultado de caixa', valor: brl(rec - desp), detalhe: `recebido ${mil(rec)} − pago ${mil(desp)}` },
        { rotulo: `Caixa em ${fimDoMesCurto(c)}`, valor: brl(caixa), detalhe: `${caixa - caixaIni >= 0 ? '+' : '−'}${mil(Math.abs(caixa - caixaIni))} mil no ano` },
        crescimento != null && {
          rotulo: 'Crescimento',
          valor: `${variacao(fat, fatAnt, 0)}`,
          detalhe: meta != null ? `meta de ${numero(meta * 100, 1)}%` : 'sem meta definida',
          alerta: meta != null && crescimento < meta,
        },
        { rotulo: 'Clientes', valor: `${det.clientes.length} atendidos`, detalhe: `${novos.length} novos no ano` },
      ]),
    },
    comentarios: ok([
      limiteTexto(base, c),
      `Maior mês: ${nomeMes(melhorMes)} (${brl(base.fat(melhorMes))}).`,
      det.clientes[0] && totalCli > 0 && `${nomeCurto(det.clientes[0].nome)} respondeu por ${pct(det.clientes[0].v, totalCli)} do ano.`,
    ]),
    fonte: fonteWorkbook(c),
  };

  const acum = (aa: number) => {
    let s = 0;
    return base.doAno(aa).map((m) => (m > c ? null : (s += base.fat(m))));
  };
  const acAt = acum(a);
  const acAnt = acum(a - 1);
  const cruzou = limite ? mesQueCruzouLimite(base, a, c, limite) : null;
  const acumulado: Slide = {
    codigo: 'acumulado_limite',
    rotulo: 'Faturamento acumulado',
    mensagem: cruzou
      ? `O faturamento acumulado passou o limite da ME em ${nomeMes(cruzou)}`
      : limite
        ? `O ano fechou com ${pct(fat, limite)} do limite da ME`
        : `Faturamento acumulado de ${brl(fat)} no ano`,
    visual: {
      tipo: 'linhas',
      categorias: MESES_CURTOS,
      series: [
        { nome: String(a - 1), valores: acAnt, cor: 'anterior' },
        { nome: String(a), valores: acAt, cor: 'atual' },
      ],
      referencia: limite ? { valor: limite, rotulo: `Limite ME · ${mil(limite, 0)} mil` } : undefined,
      marca: cruzou ? { serie: 1, indice: Number(cruzou.slice(5, 7)) - 1, rotulo: `${mesCurto(cruzou)} · ${mil(acAt[Number(cruzou.slice(5, 7)) - 1] ?? 0)}` } : undefined,
    },
    comentarios: ok([
      `${a}: ${brl(fat)} · ${a - 1}: ${brl(soma(base.doAno(a - 1).map((m) => base.fat(m))))}.`,
      limite && `Limite anual da ME: ${brl(limite, 0)}.`,
      cruzou && `A partir de ${nomeMes(cruzou)}, o excedente pede revisão do enquadramento.`,
    ]),
    fonte: 'Notas fiscais emitidas · acumulado',
  };

  const mensal: Slide = {
    codigo: 'faturamento_mensal',
    rotulo: 'Faturamento mês a mês',
    mensagem: `Maior mês de ${a}: ${nomeMes(melhorMes)}, com ${brl(base.fat(melhorMes))}`,
    visual: {
      tipo: 'barras',
      categorias: MESES_CURTOS.slice(0, ate),
      series: [
        { nome: String(a - 1), valores: base.doAno(a - 1, ate).map((m) => base.fat(m)), cor: 'anterior' },
        { nome: String(a), valores: M.map((m) => base.fat(m)), cor: 'atual' },
      ],
      destaque: ate - 1,
    },
    comentarios: ok([
      `Média de ${brl(fat / M.length)} por mês (${a - 1}: ${brl(fatAnt / M.length)}).`,
      `${M.filter((m, i) => base.fat(m) > base.fat(base.doAno(a - 1, ate)[i])).length} dos ${M.length} meses acima do mesmo mês de ${a - 1}.`,
      `Menor mês: ${nomeMes([...M].sort((x, y) => base.fat(x) - base.fat(y))[0])}.`,
    ]),
    fonte: 'Notas fiscais emitidas',
  };

  const tri3 = [a - 2, a - 1, a].map((aa) => trimestres(base, aa, aa === a ? c : `${aa}-12`, 'faturamento'));
  const triAnos: Slide = {
    codigo: 'faturamento_trimestres',
    rotulo: 'Faturamento por trimestre',
    mensagem: (() => {
      const tot = tri3.map((xs) => soma(xs.map((x) => x ?? 0)));
      return tot[0] > 0 ? `Em três anos, o faturamento foi de ${brl(tot[0])} para ${brl(tot[2])}` : `Faturamento por trimestre em ${a - 1} e ${a}`;
    })(),
    visual: {
      tipo: 'barras',
      categorias: [1, 2, 3, 4].map((x) => nomeTrimestre(x)),
      series: [
        { nome: String(a - 2), valores: tri3[0], cor: 'neutro' },
        { nome: String(a - 1), valores: tri3[1], cor: 'anterior' },
        { nome: String(a), valores: tri3[2], cor: 'atual' },
      ],
    },
    comentarios: ok([
      (() => {
        const xs = tri3[2].map((x) => x ?? 0);
        const i = xs.indexOf(Math.max(...xs));
        return `Melhor trimestre de ${a}: ${nomeTrimestre(i + 1)} (${brl(xs[i])}).`;
      })(),
      `${a - 1}: ${brl(soma(tri3[1].map((x) => x ?? 0)))} · ${a - 2}: ${brl(soma(tri3[0].map((x) => x ?? 0)))}.`,
      fatAnt > 0 && `Crescimento de ${a} sobre ${a - 1}: ${variacao(fat, fatAnt, 0)}.`,
    ]),
    fonte: 'Notas fiscais emitidas · trimestres',
  };

  const clientes = slideClientes(base, per, 10);
  if (clientes && totalCli > 0) {
    let acc = 0;
    let n80 = 0;
    for (const x of det.clientes) {
      acc += x.v;
      n80++;
      if (acc / totalCli >= 0.8) break;
    }
    clientes.rotulo = 'Clientes do ano';
    clientes.comentarios = [
      `${n80} de ${det.clientes.length} clientes fazem 80% do faturamento (curva A).`,
      `${porExtensoMaiusculo(novos.length)} ${novos.length === 1 ? 'cliente novo' : 'clientes novos'} no ano.`,
      clientes.comentarios[1],
    ];
  }

  const resMes = M.map((m) => base.res(m));
  let acc = 0;
  const resultado: Slide = {
    codigo: 'resultado_mensal',
    rotulo: 'Resultado de caixa',
    mensagem: `Resultado de caixa de ${brl(rec - desp)} no ano, positivo em ${resMes.filter((x) => x > 0).length} dos ${M.length} meses`,
    visual: {
      tipo: 'barras',
      categorias: MESES_CURTOS.slice(0, ate),
      series: [
        { nome: 'Positivo', valores: resMes.map((x) => (x > 0 ? x : 0)), cor: 'atual' },
        { nome: 'Negativo', valores: resMes.map((x) => (x < 0 ? x : 0)), cor: 'ruim' },
      ],
      empilhado: true,
    },
    comentarios: ok([
      `Acumulado mês a mês: ${resMes.map((x) => mil((acc += x), 0)).filter((_, i) => i % 3 === 2 || i === resMes.length - 1).join(' → ')} mil.`,
      `Melhor mês: ${nomeMes(M[resMes.indexOf(Math.max(...resMes))])} (${brl(Math.max(...resMes))}).`,
      Math.min(...resMes) < 0 ? `Pior mês: ${nomeMes(M[resMes.indexOf(Math.min(...resMes))])} (${brl(Math.min(...resMes))}).` : 'Nenhum mês com resultado negativo.',
    ]),
    fonte: `Regime de caixa · ${fonteWorkbook(c)}`,
  };

  const est = base.estoque(c);
  const giro = slideCapitalGiro(base, c, est.total > 0 ? `Estoque em ${fimDoMesCurto(c)}: ${brl(est.total)}.` : undefined);
  if (giro) {
    giro.rotulo = 'Capital de giro e estoque';
    if (est.total > 0) giro.comentarios = [giro.comentarios[0], giro.comentarios[1], `Estoque em ${fimDoMesCurto(c)}: ${brl(est.total)} (produtos ${brl(est.produtos)}).`];
  }

  const destaques: Slide = {
    codigo: 'destaques',
    rotulo: 'Destaques do ano',
    mensagem: `${porExtensoMaiusculo(4)} marcas de ${a}`,
    visual: {
      tipo: 'lista',
      itens: ok([
        fatAnt > 0 && `Crescimento. Faturamento ${variacao(fat, fatAnt, 0)} sobre ${a - 1}, com ${brl(fat)} no ano.`,
        `Maior mês. ${nomeMesMaiusculo(melhorMes)}, com ${brl(base.fat(melhorMes))}.`,
        det.clientes[0] && `Maior cliente. ${nomeCurto(det.clientes[0].nome)}, com ${brl(det.clientes[0].v)} (${pct(det.clientes[0].v, totalCli)}).`,
        `Caixa. De ${brl(caixaIni)} para ${brl(caixa)} em ${fimDoMesCurto(c)}.`,
        novos.length > 0 && `Clientes novos. ${porExtensoMaiusculo(novos.length)} grupos compraram pela primeira vez.`,
      ]).slice(0, 4),
    },
    comentarios: [],
    fonte: '',
  };
  destaques.mensagem = `${porExtensoMaiusculo((destaques.visual as { itens: string[] }).itens.length, true)} marcas de ${a}`;

  const metaProx = base.metaCrescimento(a + 1);
  const limProx = base.limite(a + 1);
  const metas: Slide = {
    codigo: 'metas',
    rotulo: `Metas de ${a + 1}`,
    mensagem: metaProx != null ? `Meta de ${a + 1}: crescer ${numero(metaProx * 100, 1)}% e faturar ${brl(fat * (1 + metaProx))}` : `Metas de ${a + 1} a definir`,
    visual: {
      tipo: 'lista',
      itens: ok([
        metaProx != null
          ? `Crescimento. Meta de ${numero(metaProx * 100, 1)}% sobre ${a}: ${brl(fat * (1 + metaProx))} no ano, ${brl((fat * (1 + metaProx)) / 12)} por mês.`
          : `Crescimento. Definir a meta de ${a + 1} nos parâmetros do Workbook.`,
        limProx
          ? `Limite de faturamento. ${brl(limProx, 0)} em ${a + 1}.`
          : `Limite de faturamento. Informar o limite de ${a + 1} nos parâmetros do Workbook.`,
        cruzou && `Enquadramento. ${a} passou o limite da ME em ${nomeMes(cruzou)}: decidir o regime de ${a + 1}.`,
      ]),
    },
    comentarios: [],
    fonte: 'Parâmetros do Workbook',
  };

  return ok([
    slideCapa('Fechamento anual', String(a), ate === 12 ? 'Janeiro a dezembro' : `Janeiro a ${nomeMes(c)}`, c, geradoEm),
    numeros,
    acumulado,
    mensal,
    triAnos,
    clientes,
    slideMapa(base, per, perAnt),
    slideDespesas(base, per),
    resultado,
    slideCaixa(base, per, c),
    giro,
    slideSocios(base, per, c),
    slideRedes(base, c),
    destaques,
    metas,
  ]);
}

// --------------------------------------------------------------- entrada ----

export function montarDeck(dados: ApresentacaoFechamentoDados, versao: VersaoApresentacao, opts: OpcoesDeck = {}): Deck {
  const base = new BaseFechamento(dados);
  const c = dados.competencia;
  const geradoEm = opts.geradoEm ?? new Date();
  const t = trimestre(c);
  const slides = versao === 'anual' ? deckAnual(base, c, geradoEm) : versao === 'trimestral' ? deckTrimestral(base, c, geradoEm) : deckMensal(base, c, geradoEm);
  const meses = versao === 'anual' ? base.doAno(base.ano, Number(c.slice(5, 7))) : versao === 'trimestral' ? base.doTrimestre(base.ano, t) : [c];
  const sufixo = versao === 'anual' ? 'do ano' : versao === 'trimestral' ? 'do trimestre' : 'do mês';
  const periodo = versao === 'anual' ? String(base.ano) : versao === 'trimestral' ? `${nomeTrimestre(t, true)} de ${base.ano}` : `${nomeMesMaiusculo(c)} de ${base.ano}`;
  const rodape = versao === 'anual'
    ? `Fechamento anual ${base.ano}`
    : versao === 'trimestral'
      ? `Fechamento ${nomeTrimestre(t)}/${base.ano}`
      : `Fechamento ${nomeMes(c)}/${anoDe(c)}`;
  return { versao, competencia: c, periodo, rodape, slides, alertas: calcularAlertas(base, { meses, sufixo }) };
}

/** Aplica as edições da página: título, comentários, itens e slides ocultos. */
export function aplicarEdicoes(deck: Deck, edicoes: EdicoesDeck = {}): Deck {
  const slides = deck.slides
    .filter((s) => !edicoes[s.codigo]?.oculto)
    .map((s) => {
      const e = edicoes[s.codigo];
      if (!e) return s;
      const visual = e.itens && s.visual.tipo === 'lista' ? { ...s.visual, itens: e.itens.filter((x) => x.trim()) } : s.visual;
      return {
        ...s,
        mensagem: e.mensagem?.trim() || s.mensagem,
        comentarios: e.comentarios ? e.comentarios.filter((x) => x.trim()).slice(0, 4) : s.comentarios,
        visual,
      };
    });
  return { ...deck, slides };
}

/** Nome do arquivo .pptx: "AviZee_fechamento_2026-09_trimestral.pptx". */
export function nomeArquivoDeck(deck: Pick<Deck, 'competencia' | 'versao'>): string {
  return `AviZee_fechamento_${deck.competencia}_${deck.versao}.pptx`;
}

