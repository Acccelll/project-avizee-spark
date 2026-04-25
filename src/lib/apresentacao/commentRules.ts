import type { SlideCodigo } from '@/types/apresentacao';
import { calculateVariation, formatCurrency, formatPercent } from './utils';

export interface ExecutiveComment {
  text: string;
  severity: 'info' | 'warning' | 'critical' | 'positive';
  priority: number;
  tags: string[];
}

const LIMITE_ME_ANUAL = 360_000; // R$ 360k Microempresa (LC 123/2006)
const COBERTURA_CAIXA_ATENCAO = 30; // %
const COBERTURA_CAIXA_CRITICA = 15;
const VARIACAO_RELEVANTE = 10; // %
const VARIACAO_ALERTA = 25;
const INADIMPLENCIA_ALERTA = 10;
const INADIMPLENCIA_CRITICA = 15;
const CONCENTRACAO_ALERTA = 30; // % de um único cliente/fornecedor

function severityForVariation(variation: number, isReceita = true): ExecutiveComment['severity'] {
  const abs = Math.abs(variation);
  if (isReceita) {
    if (variation <= -VARIACAO_ALERTA) return 'critical';
    if (variation <= -VARIACAO_RELEVANTE) return 'warning';
    if (variation >= VARIACAO_ALERTA) return 'positive';
    return 'info';
  }
  // despesa: subir é ruim
  if (variation >= VARIACAO_ALERTA) return 'critical';
  if (variation >= VARIACAO_RELEVANTE) return 'warning';
  if (variation <= -VARIACAO_RELEVANTE) return 'positive';
  return 'info';
}

function topItems(list: unknown, n = 3): Array<{ nome: string; valor: number; pct?: number }> {
  if (!Array.isArray(list)) return [];
  return list
    .slice(0, n)
    .map((it: any) => ({
      nome: String(it?.nome ?? it?.cliente ?? it?.fornecedor ?? it?.descricao ?? 'N/I'),
      valor: Number(it?.valor ?? it?.total ?? 0),
      pct: it?.pct != null ? Number(it.pct) : undefined,
    }));
}

function buildCoreSummary(slide: SlideCodigo, data: Record<string, unknown>): ExecutiveComment {
  const current = Number(data.valor_atual ?? data.total_atual ?? 0);
  const previous = Number(data.valor_anterior ?? data.total_anterior ?? 0);
  const variation = calculateVariation(current, previous);

  const isDespesa = slide === 'despesas' || slide === 'fopag' || slide === 'tributos';
  const common: ExecutiveComment = {
    text: `Valor atual ${formatCurrency(current)} (${variation >= 0 ? '+' : ''}${formatPercent(variation)} vs período anterior).`,
    severity: severityForVariation(variation, !isDespesa),
    priority: 1,
    tags: [slide, 'variacao'],
  };

  if (slide === 'inadimplencia') {
    const pct = Number(data.pct_inadimplencia ?? 0);
    return {
      text: `Inadimplência em ${formatCurrency(Number(data.valor_inadimplente ?? 0))} (${formatPercent(pct)} da carteira).`,
      severity: pct >= INADIMPLENCIA_CRITICA ? 'critical' : pct >= INADIMPLENCIA_ALERTA ? 'warning' : 'info',
      priority: 1,
      tags: ['risco_caixa', 'recebiveis'],
    };
  }

  if (slide === 'backorder') {
    const qtd = Number(data.qtd_pedidos_pendentes ?? 0);
    return {
      text: `Backorder: ${qtd} pedido${qtd === 1 ? '' : 's'} pendente${qtd === 1 ? '' : 's'} (${formatCurrency(Number(data.valor_backorder ?? 0))}).`,
      severity: qtd >= 10 ? 'critical' : qtd > 0 ? 'warning' : 'positive',
      priority: 1,
      tags: ['carteira', 'operacional'],
    };
  }

  return common;
}

function buildConcentrationComment(slide: SlideCodigo, data: Record<string, unknown>): ExecutiveComment | null {
  if (slide !== 'top_clientes' && slide !== 'top_fornecedores') return null;

  const ranking = topItems(data.ranking ?? data.top ?? data.itens, 3);
  const lider = ranking[0] ?? {
    nome: String(data.cliente_lider ?? data.fornecedor_lider ?? 'N/I'),
    valor: Number(data.valor_lider ?? 0),
    pct: data.pct_lider != null ? Number(data.pct_lider) : undefined,
  };
  const totalCarteira = Number(data.total_carteira ?? data.valor_total ?? 0);
  const pctLider = lider.pct ?? (totalCarteira ? (lider.valor / totalCarteira) * 100 : 0);

  const tipo = slide === 'top_clientes' ? 'clientes' : 'fornecedores';
  const lista = ranking.length
    ? ranking.map((r) => `${r.nome} (${formatCurrency(r.valor)})`).join(', ')
    : `${lider.nome} (${formatCurrency(lider.valor)})`;

  return {
    text: `Top ${ranking.length || 1} ${tipo}: ${lista}.${pctLider >= CONCENTRACAO_ALERTA ? ` Atenção: líder concentra ${formatPercent(pctLider)} do total.` : ''}`,
    severity: pctLider >= CONCENTRACAO_ALERTA ? 'warning' : 'info',
    priority: 2,
    tags: ['concentracao', tipo],
  };
}

function buildLimiteMEComment(slide: SlideCodigo, data: Record<string, unknown>): ExecutiveComment | null {
  if (slide !== 'faturamento' && slide !== 'highlights_financeiros') return null;
  const acumulado12m = Number(data.faturamento_12m ?? data.acumulado_12m ?? data.valor_atual ?? 0);
  if (!acumulado12m) return null;
  const pctLimite = (acumulado12m / LIMITE_ME_ANUAL) * 100;
  if (pctLimite < 70) {
    return {
      text: `Faturamento 12M ${formatCurrency(acumulado12m)} — ${formatPercent(pctLimite)} do limite ME (${formatCurrency(LIMITE_ME_ANUAL)}).`,
      severity: 'info',
      priority: 3,
      tags: ['limite_me', 'tributario'],
    };
  }
  return {
    text: `Atenção limite ME: faturamento 12M ${formatCurrency(acumulado12m)} já representa ${formatPercent(pctLimite)} do teto de ${formatCurrency(LIMITE_ME_ANUAL)}.`,
    severity: pctLimite >= 95 ? 'critical' : 'warning',
    priority: 1,
    tags: ['limite_me', 'tributario', 'risco'],
  };
}

function buildYoYComment(slide: SlideCodigo, data: Record<string, unknown>): ExecutiveComment | null {
  const yoy = data.variacao_yoy ?? data.var_yoy;
  if (yoy == null) return null;
  const v = Number(yoy);
  const isDespesa = slide === 'despesas' || slide === 'fopag' || slide === 'tributos';
  return {
    text: `Variação YoY: ${v >= 0 ? '+' : ''}${formatPercent(v)} vs mesmo período do ano anterior.`,
    severity: severityForVariation(v, !isDespesa),
    priority: 2,
    tags: ['yoy', slide],
  };
}

function buildCoberturaComment(slide: SlideCodigo, data: Record<string, unknown>): ExecutiveComment | null {
  if (slide !== 'rol_caixa' && slide !== 'fluxo_caixa' && slide !== 'capital_giro') return null;
  const cobertura = Number(data.cobertura_pct ?? data.cobertura ?? 0);
  if (!cobertura) return null;
  if (cobertura >= COBERTURA_CAIXA_ATENCAO) {
    return {
      text: `Cobertura de caixa saudável: ${formatPercent(cobertura)}.`,
      severity: 'positive',
      priority: 3,
      tags: ['caixa', 'cobertura'],
    };
  }
  return {
    text: cobertura < COBERTURA_CAIXA_CRITICA
      ? `Risco crítico de caixa: cobertura em ${formatPercent(cobertura)} (mínimo recomendado ${COBERTURA_CAIXA_ATENCAO}%).`
      : `Cobertura de caixa em ${formatPercent(cobertura)} — abaixo do limite de atenção (${COBERTURA_CAIXA_ATENCAO}%).`,
    severity: cobertura < COBERTURA_CAIXA_CRITICA ? 'critical' : 'warning',
    priority: 1,
    tags: ['caixa', 'risco_caixa'],
  };
}

export function buildAutomaticComments(slide: SlideCodigo, data: Record<string, unknown>): ExecutiveComment[] {
  if (data.indisponivel) {
    return [{ text: 'Dados indisponíveis ou não automatizados nesta fase.', severity: 'warning', priority: 1, tags: ['indisponivel'] }];
  }

  const comments: ExecutiveComment[] = [buildCoreSummary(slide, data)];
  const concentration = buildConcentrationComment(slide, data);
  if (concentration) comments.push(concentration);

  const cobertura = buildCoberturaComment(slide, data);
  if (cobertura) comments.push(cobertura);

  const limiteME = buildLimiteMEComment(slide, data);
  if (limiteME) comments.push(limiteME);

  const yoy = buildYoYComment(slide, data);
  if (yoy) comments.push(yoy);

  return comments.sort((a, b) => a.priority - b.priority).slice(0, 3);
}

export function buildAutomaticComment(slide: SlideCodigo, data: Record<string, unknown>): string {
  return buildAutomaticComments(slide, data).map((c) => c.text).join(' | ');
}
