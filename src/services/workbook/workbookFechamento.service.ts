import { supabase } from '@/integrations/supabase/client';
import { METRICAS_MANUAIS } from '@/lib/workbook/fechamento/types';

/** Métricas do Workbook de Fechamento que são digitadas no fechamento. */
export const METRICAS_ENTRADA_MANUAL = METRICAS_MANUAIS;
export type MetricaEntradaManual = (typeof METRICAS_ENTRADA_MANUAL)[number];

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

/** Carteira de pedidos informada no fechamento: mês previsto (AAAA-MM) → valor. */
export async function carregarCarteira(competencia: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('workbook_valores_mensais')
    .select('chave, valor')
    .eq('competencia', competencia)
    .eq('metrica', 'backlog');
  if (error) throw error;
  const out: Record<string, number> = {};
  for (const r of data ?? []) out[r.chave] = Number(r.valor);
  return out;
}

/**
 * Grava a carteira do fechamento: um valor por mês previsto de faturamento.
 * Meses com `null` são apagados; com 0 ficam gravados (carteira vazia no mês).
 */
export async function salvarCarteira(competencia: string, valores: Record<string, number | null>): Promise<void> {
  const apagar = Object.keys(valores).filter((m) => valores[m] === null);
  const gravar = Object.entries(valores)
    .filter((e): e is [string, number] => e[1] !== null)
    .map(([chave, valor]) => ({ competencia, metrica: 'backlog', chave, valor, fonte: 'manual', updated_at: new Date().toISOString() }));
  if (apagar.length) {
    const { error } = await supabase
      .from('workbook_valores_mensais')
      .delete()
      .eq('competencia', competencia)
      .eq('metrica', 'backlog')
      .in('chave', apagar);
    if (error) throw error;
  }
  if (gravar.length) {
    const { error } = await supabase
      .from('workbook_valores_mensais')
      .upsert(gravar, { onConflict: 'empresa_id,competencia,metrica,chave' });
    if (error) throw error;
  }
}

/**
 * Informa o total de rendimentos de aplicações do mês. O banco mantém um
 * recebimento na conta 6.1.2.01.001 (último dia do mês) que completa o que já
 * estiver lançado no Financeiro; 0 cancela esse recebimento. Devolve o total.
 */
export async function registrarRendimentosMes(competencia: string, valor: number): Promise<number> {
  const { data, error } = await supabase.rpc('registrar_rendimentos_mes', { p_competencia: competencia, p_valor: valor });
  if (error) throw error;
  return Number(data ?? 0);
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
