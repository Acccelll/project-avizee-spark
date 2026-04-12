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

  const [
    highlights,
    faturamento,
    despesas,
    rolCaixa,
    receitaVsDespesa,
    fopag,
    fluxoCaixa,
    lucroProdutoCliente,
    variacaoEstoque,
    vendaEstado,
    redesSociais
  ] = await Promise.all([
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
  ]);

  return {
    highlights: highlights.data ?? [],
    faturamento: faturamento.data ?? [],
    despesas: despesas.data ?? [],
    rolCaixa: rolCaixa.data ?? [],
    receitaVsDespesa: receitaVsDespesa.data ?? [],
    fopag: fopag.data ?? [],
    fluxoCaixa: fluxoCaixa.data ?? [],
    lucroProdutoCliente: lucroProdutoCliente.data ?? [],
    variacaoEstoque: variacaoEstoque.data ?? [],
    vendaEstado: vendaEstado.data ?? [],
    redesSociais: redesSociais.data ?? [],
  };
}
