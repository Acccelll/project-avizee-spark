import { supabase } from '@/integrations/supabase/client';
import type { ApresentacaoModoGeracao, ApresentacaoData } from '@/types/apresentacao';

export async function fetchPresentationData(
  compIni: string,
  compFim: string,
  modoGeracao: ApresentacaoModoGeracao
): Promise<ApresentacaoData> {
  const iniYM = compIni.slice(0, 7);
  const fimYM = compFim.slice(0, 7);

  if (modoGeracao === 'fechado') {
    // Verificar se há fechamentos
    const { data: fechamentos } = await supabase
      .from('fechamentos_mensais')
      .select('id')
      .gte('competencia', iniYM + '-01')
      .lte('competencia', fimYM + '-01')
      .eq('status', 'fechado');

    if (!fechamentos || fechamentos.length === 0) {
      throw new Error('Nenhum fechamento concluído encontrado para o período informado.');
    }
  }

  const queries = [
    supabase.from('vw_apresentacao_highlights_financeiros').select('*').gte('competencia', iniYM).lte('competencia', fimYM),
    supabase.from('vw_apresentacao_faturamento').select('*').gte('competencia', iniYM).lte('competencia', fimYM),
    supabase.from('vw_apresentacao_despesas').select('*').gte('competencia', iniYM).lte('competencia', fimYM),
    supabase.from('vw_apresentacao_rol_caixa').select('*').gte('competencia', iniYM).lte('competencia', fimYM),
    supabase.from('vw_apresentacao_receita_vs_despesa').select('*').gte('competencia', iniYM).lte('competencia', fimYM),
    supabase.from('vw_apresentacao_fopag').select('*').gte('competencia', iniYM).lte('competencia', fimYM),
    supabase.from('vw_apresentacao_fluxo_caixa').select('*').gte('competencia', iniYM).lte('competencia', fimYM),
    supabase.from('vw_apresentacao_lucro_produto_cliente').select('*').gte('competencia', iniYM).lte('competencia', fimYM),
    supabase.from('vw_apresentacao_variacao_estoque').select('*').gte('competencia', iniYM).lte('competencia', fimYM),
    supabase.from('vw_apresentacao_venda_estado').select('*').gte('competencia', iniYM).lte('competencia', fimYM),
    supabase.from('vw_apresentacao_redes_sociais').select('*').gte('competencia', iniYM).lte('competencia', fimYM),

    // Fase 2
    supabase.from('vw_apresentacao_dre_gerencial').select('*').gte('competencia', iniYM).lte('competencia', fimYM),
    supabase.from('vw_apresentacao_bridge_ebitda').select('*').gte('competencia', iniYM).lte('competencia', fimYM),
    supabase.from('vw_apresentacao_capital_giro').select('*'),
    supabase.from('vw_apresentacao_aging_consolidado').select('*'),
    supabase.from('vw_apresentacao_backorder').select('*').gte('competencia', iniYM).lte('competencia', fimYM),
    supabase.from('vw_apresentacao_top_clientes').select('*'),
    supabase.from('vw_apresentacao_top_fornecedores').select('*'),
    supabase.from('vw_apresentacao_inadimplencia').select('*'),
    supabase.from('vw_apresentacao_resultado_financeiro').select('*').gte('competencia', iniYM).lte('competencia', fimYM),
    supabase.from('vw_apresentacao_tributos').select('*').gte('competencia', iniYM).lte('competencia', fimYM),
    supabase.from('vw_apresentacao_debt').select('*'),
    supabase.from('vw_apresentacao_balanco_gerencial').select('*'),
  ];

  const results = await Promise.all(queries);

  return {
    highlights: results[0].data ?? [],
    faturamento: results[1].data ?? [],
    despesas: results[2].data ?? [],
    rolCaixa: results[3].data ?? [],
    receitaVsDespesa: results[4].data ?? [],
    fopag: results[5].data ?? [],
    fluxoCaixa: results[6].data ?? [],
    lucroProdutoCliente: results[7].data ?? [],
    variacaoEstoque: results[8].data ?? [],
    vendaEstado: results[9].data ?? [],
    redesSociais: results[10].data ?? [],
    // Fase 2
    dreGerencial: results[11].data ?? [],
    bridgeEbitda: results[12].data ?? [],
    capitalGiro: results[13].data ?? [],
    agingConsolidado: results[14].data ?? [],
    backorder: results[15].data ?? [],
    topClientes: results[16].data ?? [],
    topFornecedores: results[17].data ?? [],
    inadimplencia: results[18].data ?? [],
    resultadoFinanceiro: results[19].data ?? [],
    tributos: results[20].data ?? [],
    debt: results[21].data ?? [],
    balancoGerencial: results[22].data ?? [],
  };
}
