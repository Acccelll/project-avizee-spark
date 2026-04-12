/**
 * Deterministic comment generation engine — V1 + V2.
 * Rules are auditable and data-driven — no LLM or invented text.
 *
 * V2 additions:
 *   - prioridade (1–5) attached to each SlideComentarioInput
 *   - Richer V1 rules (vs previous month, top-impact context)
 *   - 8 new V2 slide rules
 */
import type {
  ApresentacaoRawData,
  SlideComentarioInput,
} from '@/types/apresentacao';
import {
  formatCurrencyBR,
  formatCompetencia,
  calcularVariacaoPercent,
  labelVariacao,
  topN,
  sumValues,
} from './utils';
import { SLIDE_DEFINITIONS } from './slideDefinitions';

export function gerarComentariosAutomaticos(
  data: ApresentacaoRawData,
  competenciaInicial: string,
  competenciaFinal: string
): SlideComentarioInput[] {
  const periodo = `${formatCompetencia(competenciaInicial)} a ${formatCompetencia(competenciaFinal)}`;
  const results: SlideComentarioInput[] = [];

  SLIDE_DEFINITIONS.forEach((slide, idx) => {
    const { comentario, prioridade } = buildComentario(slide.codigo, data, periodo);
    results.push({
      codigo: slide.codigo,
      titulo: slide.titulo,
      comentario_automatico: comentario,
      ordem: idx,
      prioridade,
    });
  });

  return results;
}

// Internal return type
interface ComentarioResult {
  comentario: string;
  /** 1 = normal, 2 = elevated, 3 = high, 4 = urgent, 5 = critical */
  prioridade: number;
}

function buildComentario(
  codigo: string,
  data: ApresentacaoRawData,
  periodo: string
): ComentarioResult {
  switch (codigo) {
    case 'cover':
      return {
        comentario: `Apresentação gerencial referente ao período ${periodo}.`,
        prioridade: 1,
      };

    case 'highlights_financeiros': {
      const last = data.highlights[data.highlights.length - 1];
      const prev = data.highlights[data.highlights.length - 2];
      if (!last) return { comentario: 'Dados de highlights financeiros indisponíveis para o período.', prioridade: 1 };
      const varReceita = prev ? calcularVariacaoPercent(last.total_receita, prev.total_receita) : null;
      const varDespesa = prev ? calcularVariacaoPercent(last.total_despesa, prev.total_despesa) : null;
      const resultado = last.resultado_bruto;
      const prio = resultado < 0 ? 4 : varReceita !== null && varReceita < -10 ? 3 : 1;
      return {
        comentario:
          `Receita: R$ ${formatCurrencyBR(last.total_receita)}${varReceita !== null ? ` (${labelVariacao(varReceita)} vs mês anterior)` : ''}. ` +
          `Despesa: R$ ${formatCurrencyBR(last.total_despesa)}${varDespesa !== null ? ` (${labelVariacao(varDespesa)} vs mês anterior)` : ''}. ` +
          `Resultado bruto: R$ ${formatCurrencyBR(resultado)}${resultado < 0 ? ' ⚠️ Negativo.' : '.'}`,
        prioridade: prio,
      };
    }

    case 'faturamento': {
      const last = data.faturamento[data.faturamento.length - 1];
      const prev = data.faturamento[data.faturamento.length - 2];
      if (!last) return { comentario: 'Dados de faturamento indisponíveis para o período.', prioridade: 1 };
      const varFat = prev ? calcularVariacaoPercent(last.total_faturado, prev.total_faturado) : null;
      const prio = varFat !== null && varFat < -15 ? 3 : varFat !== null && varFat > 15 ? 2 : 1;
      return {
        comentario:
          `Faturamento de R$ ${formatCurrencyBR(last.total_faturado)} com ${last.quantidade_nfs} notas emitidas.` +
          (varFat !== null ? ` Variação vs mês anterior: ${labelVariacao(varFat)}.` : ''),
        prioridade: prio,
      };
    }

    case 'despesas': {
      const porCategoria = data.despesas.reduce<Record<string, number>>((acc, d) => {
        acc[d.categoria] = (acc[d.categoria] ?? 0) + d.total_despesa;
        return acc;
      }, {});
      const maiorCat = Object.entries(porCategoria).sort((a, b) => b[1] - a[1])[0];
      const total = sumValues(Object.values(porCategoria));
      if (total === 0) return { comentario: 'Dados de despesas indisponíveis para o período.', prioridade: 1 };
      return {
        comentario:
          `Total de despesas no período: R$ ${formatCurrencyBR(total)}.` +
          (maiorCat ? ` Maior categoria: "${maiorCat[0]}" com R$ ${formatCurrencyBR(maiorCat[1])}.` : ''),
        prioridade: 1,
      };
    }

    case 'rol_caixa': {
      const total = sumValues(data.rolCaixa.map((c) => c.saldo_atual));
      const qtd = data.rolCaixa.length;
      if (qtd === 0) return { comentario: 'Posição de caixa indisponível.', prioridade: 1 };
      const prio = total < 0 ? 5 : total < 10000 ? 3 : 1;
      return {
        comentario: `Saldo total em caixa: R$ ${formatCurrencyBR(total)} distribuído em ${qtd} conta(s).${total < 0 ? ' ⚠️ Saldo negativo.' : ''}`,
        prioridade: prio,
      };
    }

    case 'receita_vs_despesa': {
      const last = data.receitaVsDespesa[data.receitaVsDespesa.length - 1];
      if (!last) return { comentario: 'Dados de receita vs despesa indisponíveis.', prioridade: 1 };
      const varRec = last.receita_mes_anterior != null
        ? calcularVariacaoPercent(last.total_receita, last.receita_mes_anterior)
        : null;
      const prio = last.resultado_bruto < 0 ? 4 : 1;
      return {
        comentario:
          `Receita R$ ${formatCurrencyBR(last.total_receita)}` +
          (varRec !== null ? ` (${labelVariacao(varRec)} vs mês anterior)` : '') +
          ` vs Despesa R$ ${formatCurrencyBR(last.total_despesa)}. Resultado: R$ ${formatCurrencyBR(last.resultado_bruto)}.`,
        prioridade: prio,
      };
    }

    case 'fopag': {
      const total = sumValues(data.fopag.map((f) => f.valor_liquido));
      const qtdFunc = new Set(data.fopag.map((f) => f.funcionario_nome)).size;
      if (qtdFunc === 0) return { comentario: 'Dados de folha de pagamento indisponíveis.', prioridade: 1 };
      return {
        comentario: `Folha de pagamento: ${qtdFunc} funcionário(s), total líquido R$ ${formatCurrencyBR(total)}.`,
        prioridade: 1,
      };
    }

    case 'fluxo_caixa': {
      const totalEnt = sumValues(data.fluxoCaixa.map((f) => f.total_entradas));
      const totalSai = sumValues(data.fluxoCaixa.map((f) => f.total_saidas));
      const saldo = totalEnt - totalSai;
      if (data.fluxoCaixa.length === 0) return { comentario: 'Dados de fluxo de caixa indisponíveis.', prioridade: 1 };
      const prio = saldo < 0 ? 4 : 1;
      return {
        comentario: `Entradas R$ ${formatCurrencyBR(totalEnt)}, saídas R$ ${formatCurrencyBR(totalSai)}. Saldo: R$ ${formatCurrencyBR(saldo)}.${saldo < 0 ? ' ⚠️ Saldo negativo.' : ''}`,
        prioridade: prio,
      };
    }

    case 'lucro_produto_cliente': {
      if (data.lucro.length === 0) return { comentario: 'Dados de lucro por produto/cliente indisponíveis.', prioridade: 1 };
      const topProd = topN(data.lucro, 'margem_bruta', 1)[0];
      const topCliente = data.lucro.reduce<Record<string, number>>((acc, l) => {
        acc[l.cliente_nome] = (acc[l.cliente_nome] ?? 0) + l.margem_bruta;
        return acc;
      }, {});
      const topCli = Object.entries(topCliente).sort((a, b) => b[1] - a[1])[0];
      return {
        comentario:
          `Maior margem por produto: ${topProd.produto_nome} (R$ ${formatCurrencyBR(topProd.margem_bruta)}).` +
          (topCli ? ` Maior margem por cliente: ${topCli[0]} (R$ ${formatCurrencyBR(topCli[1])}).` : ''),
        prioridade: 1,
      };
    }

    case 'variacao_estoque': {
      const valorTotal = sumValues(data.estoque.map((e) => e.valor_total));
      const qtd = data.estoque.length;
      if (qtd === 0) return { comentario: 'Dados de estoque indisponíveis.', prioridade: 1 };
      return {
        comentario: `Estoque valorizado em R$ ${formatCurrencyBR(valorTotal)} com ${qtd} item(ns) ativo(s).`,
        prioridade: 1,
      };
    }

    case 'venda_estado': {
      if (data.vendaEstado.length === 0) return { comentario: 'Dados de venda por estado indisponíveis.', prioridade: 1 };
      const top = topN(data.vendaEstado, 'total_vendas', 1)[0];
      const totalEstados = new Set(data.vendaEstado.map((v) => v.estado)).size;
      return {
        comentario: `Principal mercado: ${top.estado} (R$ ${formatCurrencyBR(top.total_vendas)}). Total de ${totalEstados} estado(s) atendido(s).`,
        prioridade: 1,
      };
    }

    case 'redes_sociais': {
      if (data.redesSociais.length === 0) return { comentario: 'Dados de redes sociais indisponíveis para o período.', prioridade: 1 };
      const plats = [...new Set(data.redesSociais.map((r) => r.plataforma))].join(', ');
      return { comentario: `Dados disponíveis para: ${plats}.`, prioridade: 1 };
    }

    // -------------------------------------------------------
    // V2 slide comments
    // -------------------------------------------------------

    case 'aging_consolidado': {
      if (data.aging.length === 0) return { comentario: 'Dados de aging indisponíveis.', prioridade: 1 };
      const receber = data.aging.filter((a) => a.tipo === 'receber');
      const pagar = data.aging.filter((a) => a.tipo === 'pagar');
      const totalRec = sumValues(receber.map((a) => a.saldo_aberto));
      const totalPag = sumValues(pagar.map((a) => a.saldo_aberto));
      const totalVencRec = sumValues(
        receber.filter((a) => a.faixa_aging !== 'A vencer').map((a) => a.saldo_aberto)
      );
      const prio = totalVencRec > totalRec * 0.3 ? 4 : 1;
      return {
        comentario:
          `CR em aberto: R$ ${formatCurrencyBR(totalRec)}` +
          (totalVencRec > 0 ? ` (R$ ${formatCurrencyBR(totalVencRec)} vencidos).` : '.') +
          ` CP em aberto: R$ ${formatCurrencyBR(totalPag)}.`,
        prioridade: prio,
      };
    }

    case 'inadimplencia': {
      if (data.inadimplencia.length === 0) return { comentario: 'Sem títulos inadimplentes no período.', prioridade: 1 };
      const totalInadim = sumValues(data.inadimplencia.map((i) => i.saldo_inadimplente));
      const totalCli = sumValues(data.inadimplencia.map((i) => i.clientes_inadimplentes));
      const maiorFaixa = [...data.inadimplencia].sort((a, b) => b.saldo_inadimplente - a.saldo_inadimplente)[0];
      const prio = totalInadim > 50000 ? 4 : totalInadim > 10000 ? 3 : 2;
      return {
        comentario:
          `Inadimplência total: R$ ${formatCurrencyBR(totalInadim)} em ${totalCli} cliente(s). ` +
          `Maior concentração: faixa "${maiorFaixa.faixa_atraso}".`,
        prioridade: prio,
      };
    }

    case 'backorder': {
      if (data.backorder.length === 0) return { comentario: 'Sem backorder registrado no período.', prioridade: 1 };
      const total = sumValues(data.backorder.map((b) => b.valor_total));
      const qtd = data.backorder.length;
      const maiorDias = Math.max(...data.backorder.map((b) => b.dias_em_aberto));
      const prio = maiorDias > 30 ? 3 : 1;
      return {
        comentario:
          `Backorder: ${qtd} pedido(s) pendentes totalizando R$ ${formatCurrencyBR(total)}. ` +
          `Pedido mais antigo: ${maiorDias} dia(s) em aberto.`,
        prioridade: prio,
      };
    }

    case 'top_clientes': {
      if (data.topClientes.length === 0) return { comentario: 'Dados de top clientes indisponíveis.', prioridade: 1 };
      const sorted = [...data.topClientes].sort((a, b) => b.total_vendas - a.total_vendas);
      const top5 = sorted.slice(0, 5);
      const totalGeral = sumValues(sorted.map((c) => c.total_vendas));
      const totalTop5 = sumValues(top5.map((c) => c.total_vendas));
      const concentracao = totalGeral > 0 ? ((totalTop5 / totalGeral) * 100).toFixed(1) : '0.0';
      const topCli = top5[0];
      return {
        comentario:
          `Principal cliente: ${topCli.cliente_nome} (R$ ${formatCurrencyBR(topCli.total_vendas)}). ` +
          `Top 5 clientes representam ${concentracao}% do faturamento.`,
        prioridade: Number(concentracao) > 80 ? 3 : 1,
      };
    }

    case 'top_fornecedores': {
      if (data.topFornecedores.length === 0) return { comentario: 'Dados de top fornecedores indisponíveis.', prioridade: 1 };
      const sorted = [...data.topFornecedores].sort((a, b) => b.total_compras - a.total_compras);
      const top5 = sorted.slice(0, 5);
      const totalGeral = sumValues(sorted.map((f) => f.total_compras));
      const totalTop5 = sumValues(top5.map((f) => f.total_compras));
      const concentracao = totalGeral > 0 ? ((totalTop5 / totalGeral) * 100).toFixed(1) : '0.0';
      const topFor = top5[0];
      return {
        comentario:
          `Principal fornecedor: ${topFor.fornecedor_nome} (R$ ${formatCurrencyBR(topFor.total_compras)}). ` +
          `Top 5 fornecedores representam ${concentracao}% das compras.`,
        prioridade: Number(concentracao) > 80 ? 3 : 1,
      };
    }

    case 'dre_gerencial': {
      if (data.dreGerencial.length === 0) {
        return {
          comentario:
            'DRE Gerencial indisponível. Configure o mapeamento_gerencial_contas para habilitar este slide.',
          prioridade: 2,
        };
      }
      const receita = sumValues(
        data.dreGerencial.filter((d) => d.linha_dre === 'Receita Bruta').map((d) => d.valor_total)
      );
      const resultado = sumValues(data.dreGerencial.map((d) => d.valor_total * d.sinal_padrao));
      return {
        comentario:
          `DRE Gerencial: receita bruta R$ ${formatCurrencyBR(receita)}, resultado R$ ${formatCurrencyBR(resultado)}.${resultado < 0 ? ' ⚠️ Resultado negativo.' : ''}`,
        prioridade: resultado < 0 ? 4 : 1,
      };
    }

    case 'resultado_financeiro': {
      if (data.resultadoFinanceiro.length === 0) {
        return {
          comentario:
            'Resultado financeiro indisponível. Configure grupo_resultado_financeiro em mapeamento_gerencial_contas.',
          prioridade: 1,
        };
      }
      const recFin = sumValues(
        data.resultadoFinanceiro.filter((r) => r.tipo === 'receber').map((r) => r.valor_total)
      );
      const despFin = sumValues(
        data.resultadoFinanceiro.filter((r) => r.tipo === 'pagar').map((r) => r.valor_total)
      );
      const resultado = recFin - despFin;
      return {
        comentario: `Resultado financeiro: R$ ${formatCurrencyBR(resultado)} (rec. R$ ${formatCurrencyBR(recFin)} / desp. R$ ${formatCurrencyBR(despFin)}).`,
        prioridade: resultado < 0 ? 3 : 1,
      };
    }

    case 'tributos': {
      if (data.tributos.length === 0) {
        return {
          comentario:
            'Tributos indisponíveis. Configure grupo_tributo em mapeamento_gerencial_contas.',
          prioridade: 1,
        };
      }
      const total = sumValues(data.tributos.map((t) => t.valor_total));
      const pago = sumValues(data.tributos.map((t) => t.valor_pago));
      const pendente = total - pago;
      return {
        comentario:
          `Total de tributos: R$ ${formatCurrencyBR(total)}` +
          (pendente > 0 ? ` (R$ ${formatCurrencyBR(pendente)} pendente de pagamento).` : '.'),
        prioridade: pendente > total * 0.5 ? 3 : 1,
      };
    }

    default:
      return { comentario: 'Comentário automático não definido para este slide.', prioridade: 1 };
  }
}

/**
 * Returns the effective comment: edited if available, else automatic.
 */
export function getEfectiveComentario(
  comentarioAutomatico: string | null | undefined,
  comentarioEditado: string | null | undefined
): string {
  if (comentarioEditado && comentarioEditado.trim().length > 0) {
    return comentarioEditado.trim();
  }
  return comentarioAutomatico?.trim() ?? '';
}
