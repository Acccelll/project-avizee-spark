import { supabase } from '@/integrations/supabase/client';
import { buscarDadosFechamento } from '@/lib/workbook/fechamento';
import { METRICAS_MANUAIS } from '@/lib/workbook/fechamento/types';

/** Métricas do Workbook de Fechamento que são digitadas no fechamento. */
export const METRICAS_ENTRADA_MANUAL = METRICAS_MANUAIS;
export type MetricaEntradaManual = (typeof METRICAS_ENTRADA_MANUAL)[number];

export interface PreviaSocioFechamento {
  id: string;
  nome: string;
  /** Pró-labore/retirada do mês (retiradas cadastradas em Sócios). */
  retirada: number;
  /** Saldo acumulado no ano (lucro de caixa × participação). */
  saldo: number;
}

export interface PreviaFechamento {
  /** Caixa no fim do mês pelo ERP, antes do ajuste do próprio mês. */
  caixaCalculado: number;
  socios: PreviaSocioFechamento[];
}

/** Valores que o sistema calcula para o mês, exibidos ao lado das entradas manuais. */
export async function carregarPreviaFechamento(competencia: string): Promise<PreviaFechamento> {
  const dados = await buscarDadosFechamento(competencia);
  const mes = dados.meses.find((m) => m.competencia === competencia);
  return {
    caixaCalculado: Number(mes?.valores.caixa_final_calculado ?? 0),
    socios: dados.socios.map((s) => ({
      id: s.id,
      nome: s.nome_exibicao,
      retirada: Number(mes?.socios?.[s.id]?.prolabore ?? 0),
      saldo: Number(mes?.socios?.[s.id]?.saldo ?? 0),
    })),
  };
}

export interface ParametrosAnoWorkbook {
  ano: number;
  crescimento_meta: number;
  limite_faturamento: number;
}

export async function carregarEntradasManuais(competencia: string): Promise<Partial<Record<MetricaEntradaManual, number>>> {
  const { data, error } = await supabase
    .from('workbook_valores_mensais')
    .select('metrica, valor')
    .eq('competencia', competencia)
    .eq('chave', '')
    .in('metrica', [...METRICAS_ENTRADA_MANUAL]);
  if (error) throw error;
  const out: Partial<Record<MetricaEntradaManual, number>> = {};
  for (const r of data ?? []) out[r.metrica as MetricaEntradaManual] = Number(r.valor);
  return out;
}

/** Grava (ou apaga, com `null`) o valor digitado de uma métrica no mês. */
export async function salvarEntradaManual(competencia: string, metrica: MetricaEntradaManual, valor: number | null): Promise<void> {
  if (valor === null) {
    const { error } = await supabase
      .from('workbook_valores_mensais')
      .delete()
      .eq('competencia', competencia)
      .eq('metrica', metrica)
      .eq('chave', '');
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from('workbook_valores_mensais')
    .upsert(
      { competencia, metrica, chave: '', valor, fonte: 'manual', updated_at: new Date().toISOString() },
      { onConflict: 'empresa_id,competencia,metrica,chave' },
    );
  if (error) throw error;
}

export async function carregarParametrosAno(ano: number): Promise<ParametrosAnoWorkbook | null> {
  const { data, error } = await supabase
    .from('workbook_parametros_anuais')
    .select('ano, crescimento_meta, limite_faturamento')
    .eq('ano', ano)
    .maybeSingle();
  if (error) throw error;
  return data ? { ano: data.ano, crescimento_meta: Number(data.crescimento_meta), limite_faturamento: Number(data.limite_faturamento) } : null;
}

export async function salvarParametrosAno(p: ParametrosAnoWorkbook): Promise<void> {
  const { error } = await supabase
    .from('workbook_parametros_anuais')
    .upsert({ ...p, updated_at: new Date().toISOString() }, { onConflict: 'empresa_id,ano' });
  if (error) throw error;
}
