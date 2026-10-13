import type { FechamentoMes } from '@/lib/workbook/fechamento/types';
import { intervaloMeses, somarMeses } from '../formato';
import type { ApresentacaoFechamentoDados, DetalheMes } from '../tipos';

/**
 * Dados sintéticos de fechamento: 37 meses do Workbook (dez/(ano-3) a
 * dez/ano) e o detalhe por cliente, UF e categoria a partir de jan/(ano-1).
 */
export function dadosSinteticos(competencia: string, opts: { limite?: number; semDetalhe?: boolean; seguidores?: boolean; carteira?: boolean } = {}): ApresentacaoFechamentoDados {
  const ano = Number(competencia.slice(0, 4));
  const meses = intervaloMeses(`${ano - 3}-12`, `${ano}-12`);
  let caixa = 20000;
  const wbMeses: FechamentoMes[] = meses.map((c, i) => {
    const fechado = c <= competencia;
    const m = Number(c.slice(5, 7));
    const fat = 10000 + m * 1500 + (Number(c.slice(0, 4)) - ano + 3) * 4000;
    const rec = fat * 0.95;
    const desp = 9000 + (i % 4) * 1200;
    caixa += i === 0 ? 0 : rec - desp;
    const valores: FechamentoMes['valores'] = fechado
      ? {
          faturamento: fat,
          receita_caixa: rec,
          despesa_caixa: desp,
          caixa_final: Math.round(caixa * 100) / 100,
          estoque_produtos: 20000 + m * 100,
          estoque_materiais: 1500,
          aging_cr_av_0_30: 12000,
          aging_cr_av_31_60: 2000,
          aging_cr_vc_0_30: 300,
          aging_cp_av_0_30: 15000,
          aging_cp_av_61_90: 1000,
          ...(opts.seguidores ? { seguidores_linkedin: 3000 + i * 10, seguidores_instagram: 400 + i } : {}),
        }
      : {};
    return {
      competencia: c,
      fechado,
      valores,
      fontes: fechado ? { faturamento: 'erp', ...(opts.seguidores ? { seguidores_linkedin: 'manual', seguidores_instagram: 'manual' } : {}) } : {},
      socios: fechado ? { s1: { saldo: 1000 * m, prolabore: 600 }, s2: { saldo: 500 * m, prolabore: 300 } } : {},
    };
  });

  if (opts.carteira) {
    // O fechamento anterior previa faturar 10% a mais do que saiu no mês.
    const atual = wbMeses.find((w) => w.competencia === competencia)!;
    atual.valores.backlog_previsto = Math.round((atual.valores.faturamento ?? 0) * 1.1 * 100) / 100;
  }

  const detalhe: Record<string, DetalheMes> = {};
  if (!opts.semDetalhe) {
    for (const w of wbMeses) {
      if (w.competencia < `${ano - 1}-01` || !w.fechado) continue;
      const fat = w.valores.faturamento ?? 0;
      const desp = w.valores.despesa_caixa ?? 0;
      detalhe[w.competencia] = {
        clientes: [
          { k: '11111111', v: fat * 0.55, nf: 3 },
          { k: '22222222', v: fat * 0.25, nf: 2 },
          { k: '33333333', v: fat * 0.15, nf: 1 },
          { k: '44444444', v: fat * 0.05, nf: 1 },
        ],
        uf: { SP: fat * 0.6, MG: fat * 0.3, PR: fat * 0.1 },
        despesas: { 'Mercadorias para revenda': desp * 0.7, 'Impostos e taxas': desp * 0.2, 'Pró-labore': desp * 0.1 },
        fornecedores: [{ nome: 'FORNECEDOR ALFA INDUSTRIA E COMERCIO LTDA', v: desp * 0.4 }, { nome: 'Sócio - Fulano', v: 600 }],
      };
    }
  }

  return {
    competencia,
    workbook: {
      competencia,
      ano,
      saldo_caixa_anterior: 0,
      meses: wbMeses,
      socios: [
        { id: 's1', nome: 'SOCIO UM', nome_exibicao: 'Sócio Um', percentual: 60 },
        { id: 's2', nome: 'SOCIO DOIS', nome_exibicao: 'Sócio Dois', percentual: 40 },
      ],
      parametros: { [String(ano)]: { crescimento_meta: 0.1, limite_faturamento: opts.limite ?? 360000 } },
      ...(opts.carteira
        ? {
            carteira: {
              data_base: `${competencia}-30`,
              informada: true,
              meses: [1, 2, 3, 4].map((k) => ({
                mes: somarMeses(competencia, k),
                backlog: [28000, 22000, 43000, 0][k - 1],
                receber: [23000, 300, 300, 300][k - 1],
                pagar: [16000, 9500, 1500, 500][k - 1],
              })),
              backlog_depois: 0,
              receber_vencido: 0,
              pagar_vencido: 0,
              receber_depois: 4000,
              pagar_depois: 1100,
            },
          }
        : {}),
    },
    detalhe,
    grupos: { '11111111': 'CLIENTE PRINCIPAL ALIMENTOS S.A.', '22222222': 'GRANJA BETA LTDA', '33333333': 'AVICOLA GAMA', '44444444': 'SITIO DELTA' },
    primeira_compra: { '11111111': `${ano - 2}-01`, '22222222': `${ano - 1}-05`, '33333333': competencia, '44444444': `${ano - 1}-02` },
    pendencias: { extrato_pendentes: 0, extrato_ultima_data: `${competencia}-28`, notas_saida_mes: 7 },
  };
}
