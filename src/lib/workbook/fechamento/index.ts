/**
 * Workbook de Fechamento: o layout do Financeiro_workbook legado, com os
 * vínculos externos trocados pela RPC `workbook_fechamento_dados`.
 */
import { supabase } from '@/integrations/supabase/client';
import { preencherWorkbookFechamento } from './fillTemplate';
import type { FechamentoDados } from './types';

const MODELO_URL = '/workbook_fechamento_v1.xlsx';

export async function buscarDadosFechamento(competencia: string): Promise<FechamentoDados> {
  const { data, error } = await supabase.rpc('workbook_fechamento_dados', { p_competencia: competencia });
  if (error) throw error;
  return data as unknown as FechamentoDados;
}

/** Gera o Workbook de Fechamento da competência (AAAA-MM). */
export async function gerarWorkbookFechamento(competencia: string, signal?: AbortSignal): Promise<Blob> {
  const [dados, resposta] = await Promise.all([
    buscarDadosFechamento(competencia),
    fetch(MODELO_URL, { signal }),
  ]);
  if (!resposta.ok) {
    throw new Error(`Modelo do Workbook de Fechamento não encontrado (${MODELO_URL}, HTTP ${resposta.status}).`);
  }
  signal?.throwIfAborted?.();
  const modelo = await resposta.arrayBuffer();
  signal?.throwIfAborted?.();
  return (await preencherWorkbookFechamento(modelo, dados, { tipo: 'blob' })) as Blob;
}

export type { FechamentoDados } from './types';
