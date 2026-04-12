import { supabase } from '@/integrations/supabase/client';
import type { WorkbookTemplate, WorkbookGeracao, FechamentoMensal, WorkbookParametros } from '@/types/workbook';
import { generateWorkbook } from '@/lib/workbook/generateWorkbook';
import { hashParametros } from '@/lib/workbook/utils';

export async function listarTemplates(): Promise<WorkbookTemplate[]> {
  const { data, error } = await (supabase as any)
    .from('workbook_templates')
    .select('*')
    .eq('ativo', true)
    .order('nome');
  if (error) throw error;
  return (data ?? []) as WorkbookTemplate[];
}

export async function listarGeracoes(): Promise<WorkbookGeracao[]> {
  const { data, error } = await (supabase as any)
    .from('workbook_geracoes')
    .select('*, workbook_templates(nome, versao)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as WorkbookGeracao[];
}

export async function listarFechamentos(): Promise<FechamentoMensal[]> {
  const { data, error } = await (supabase as any)
    .from('fechamentos_mensais')
    .select('*')
    .order('competencia', { ascending: false });
  if (error) throw error;
  return (data ?? []) as FechamentoMensal[];
}

export async function gerarWorkbook(
  parametros: WorkbookParametros,
  userId: string | undefined
): Promise<{ blob: Blob; geracaoId: string }> {
  const hash = hashParametros(parametros as unknown as Record<string, unknown>);

  const { data: geracao, error: geracaoError } = await (supabase as any)
    .from('workbook_geracoes')
    .insert({
      template_id: parametros.templateId,
      competencia_inicial: parametros.competenciaInicial,
      competencia_final: parametros.competenciaFinal,
      modo_geracao: parametros.modoGeracao,
      status: 'gerando',
      hash_geracao: hash,
      parametros_json: parametros as unknown as Record<string, unknown>,
      gerado_por: userId ?? null,
    })
    .select()
    .single();

  if (geracaoError) throw geracaoError;

  try {
    if (parametros.modoGeracao === 'fechado') {
      const { data: fechamentos } = await (supabase as any)
        .from('fechamentos_mensais')
        .select('id, competencia, status')
        .gte('competencia', parametros.competenciaInicial)
        .lte('competencia', parametros.competenciaFinal)
        .eq('status', 'fechado');

      if (!fechamentos || fechamentos.length === 0) {
        throw new Error('Modo fechado requer fechamentos mensais concluídos para o período selecionado.');
      }
    }

    const blob = await generateWorkbook({ parametros, geracaoId: geracao.id });

    await (supabase as any)
      .from('workbook_geracoes')
      .update({ status: 'concluido', updated_at: new Date().toISOString() })
      .eq('id', geracao.id);

    return { blob, geracaoId: geracao.id };
  } catch (err) {
    await (supabase as any)
      .from('workbook_geracoes')
      .update({
        status: 'erro',
        observacoes: err instanceof Error ? err.message : String(err),
        updated_at: new Date().toISOString(),
      })
      .eq('id', geracao.id);
    throw err;
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
