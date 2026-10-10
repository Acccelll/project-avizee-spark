/**
 * Alertas automáticos do slide "Pontos de atenção" (e das metas do
 * trimestral). Cada regra olha um fato do fechamento; a ordem do retorno é a
 * ordem do slide.
 */
import type { BaseFechamento } from './base';
import { brl, mesCurto, nomeCurto, nomeMes, pct, somarMeses } from './formato';
import type { Alerta } from './tipos';

export interface OpcoesAlertas {
  /** Meses do período do deck (o mês, o trimestre ou o ano). */
  meses: string[];
  /** "do mês", "do trimestre", "do ano". */
  sufixo: string;
}

/** Mês em que o faturamento acumulado do ano passou `limite`, se passou. */
export function mesQueCruzouLimite(base: BaseFechamento, a: number, ate: string, limite: number): string | null {
  if (!limite) return null;
  let acc = 0;
  for (const c of base.doAno(a)) {
    if (c > ate) break;
    acc += base.fat(c);
    if (acc >= limite) return c;
  }
  return null;
}

export function calcularAlertas(base: BaseFechamento, opts: OpcoesAlertas): Alerta[] {
  const c = base.competencia;
  const out: Alerta[] = [];

  // 1. Limite anual da ME.
  const limite = base.limite();
  if (limite > 0) {
    const ytd = base.soma('faturamento', base.doAno(base.ano, Number(c.slice(5, 7))));
    const uso = ytd / limite;
    if (uso >= 1) {
      const quando = mesQueCruzouLimite(base, base.ano, c, limite);
      out.push({
        codigo: 'limite_me_100',
        severidade: 'alta',
        titulo: 'Enquadramento fiscal.',
        texto: `Faturamento acumulado de ${brl(ytd)} passou o limite da ME (${brl(limite, 0)})${quando ? ` em ${nomeMes(quando)}` : ''}.`,
      });
    } else if (uso >= 0.8) {
      out.push({
        codigo: 'limite_me_80',
        severidade: 'media',
        titulo: 'Limite da ME.',
        texto: `Faturamento acumulado de ${brl(ytd)} já usa ${pct(ytd, limite)} do limite anual (${brl(limite, 0)}).`,
      });
    }
  }

  // 2. Concentração em um cliente.
  const det = base.detalhe(opts.meses);
  const totalCli = det.clientes.reduce((s, x) => s + x.v, 0);
  const top = det.clientes[0];
  if (top && totalCli > 0 && top.v / totalCli > 0.3 && det.clientes.length > 1) {
    out.push({
      codigo: 'concentracao_cliente',
      severidade: top.v / totalCli > 0.5 ? 'alta' : 'media',
      titulo: 'Concentração de clientes.',
      texto: `${nomeCurto(top.nome)} respondeu por ${pct(top.v, totalCli)} do faturamento ${opts.sufixo}.`,
    });
  }

  // 3. Mais a pagar do que a receber em 30 dias.
  const cr = base.aging(c, 'cr');
  const cp = base.aging(c, 'cp');
  if (cp.ate30 > cr.ate30 && cp.ate30 > 0) {
    out.push({
      codigo: 'pagar_maior_receber_30d',
      severidade: 'media',
      titulo: `Pagamentos de ${nomeMes(somarMeses(c, 1))}.`,
      texto: `${brl(cp.ate30)} a pagar em 30 dias, contra ${brl(cr.ate30)} a receber.`,
    });
  }

  // 4. Inadimplência acima de 5% da carteira.
  if (cr.total > 0 && cr.vencido / cr.total > 0.05) {
    out.push({
      codigo: 'vencidos_receber',
      severidade: cr.vencido / cr.total > 0.15 ? 'alta' : 'media',
      titulo: 'Recebíveis vencidos.',
      texto: `${brl(cr.vencido)} vencidos a receber, ${pct(cr.vencido, cr.total)} da carteira.`,
    });
  }

  // 5. Caixa abaixo de um mês de despesa média.
  const l12 = base.ultimos12(c).filter((m) => base.fechado(m));
  const despMedia = l12.length ? l12.reduce((s, m) => s + base.desp(m), 0) / l12.length : 0;
  const caixa = base.caixa(c);
  if (despMedia > 0 && caixa < despMedia) {
    out.push({
      codigo: 'caixa_curto',
      severidade: 'alta',
      titulo: 'Caixa curto.',
      texto: `Caixa de ${brl(caixa)} cobre menos de um mês da despesa média (${brl(despMedia)}).`,
    });
  }

  // 6. Pior faturamento ou maior despesa dos últimos 12 meses.
  if (l12.length >= 6) {
    const fats = l12.map((m) => base.fat(m));
    if (base.fat(c) <= Math.min(...fats) && base.fat(c) > 0) {
      out.push({
        codigo: 'faturamento_minimo_12m',
        severidade: 'media',
        titulo: 'Faturamento baixo.',
        texto: `${brl(base.fat(c))} em ${mesCurto(c)}, o menor faturamento dos últimos 12 meses.`,
      });
    }
    const desps = l12.map((m) => base.desp(m));
    if (base.desp(c) >= Math.max(...desps) && base.desp(c) > 0) {
      out.push({
        codigo: 'despesa_maxima_12m',
        severidade: 'media',
        titulo: 'Despesa alta.',
        texto: `${brl(base.desp(c))} pagos em ${mesCurto(c)}, a maior despesa de caixa dos últimos 12 meses.`,
      });
    }
  }

  return out;
}
