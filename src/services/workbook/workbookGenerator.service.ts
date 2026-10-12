import { supabase } from '@/integrations/supabase/client';
import type { WorkbookTemplate, WorkbookGeracao, FechamentoMensal, WorkbookParametros } from '@/types/workbook';
import { hashParametros } from '@/lib/workbook/utils';
import { fromUntyped } from '@/lib/supabase/fromUntyped';
import type { WorkbookCaps } from '@/lib/workbook/fetchWorkbookData';
import { logger } from "@/lib/logger";
import type { ApresentacaoFechamentoDados } from '@/lib/apresentacao/fechamento/tipos';

/**
 * Lazy-loads the heavy ExcelJS-based workbook generator. Keeps ~400KB out of
 * the initial bundle — only paid for when the user actually generates a workbook.
 */
async function loadGenerateWorkbook() {
  const mod = await import('@/lib/workbook/generateWorkbook');
  return mod.generateWorkbook;
}

/** Código do template do Workbook de Fechamento (modelo v2, sem ExcelJS). */
export const WORKBOOK_FECHAMENTO_CODIGO = 'WB_FECHAMENTO_V2';
/** Modelo anterior do Workbook de Fechamento; gerações antigas sem arquivo são refeitas no v2. */
const WORKBOOK_FECHAMENTO_V1_CODIGO = 'WB_FECHAMENTO_V1';

export interface OpcoesGeracao {
  signal?: AbortSignal;
  caps?: WorkbookCaps;
  /** Dados do fechamento já carregados na página (evita consultar de novo). */
  dadosFechamento?: ApresentacaoFechamentoDados;
}

async function gerarBlob(parametros: WorkbookParametros, geracaoId: string, options: OpcoesGeracao): Promise<Blob> {
  if (parametros.templateCodigo === WORKBOOK_FECHAMENTO_CODIGO || parametros.templateCodigo === WORKBOOK_FECHAMENTO_V1_CODIGO) {
    const competencia = parametros.competenciaFinal.slice(0, 7);
    const [{ gerarWorkbookFechamentoV2 }, dados] = await Promise.all([
      import('@/lib/workbook/fechamento/v2'),
      options.dadosFechamento?.competencia === competencia
        ? Promise.resolve(options.dadosFechamento)
        : import('@/services/apresentacaoFechamentoService').then((m) => m.buscarDadosApresentacao(competencia)),
    ]);
    return gerarWorkbookFechamentoV2(dados, options.signal);
  }
  const generateWorkbook = await loadGenerateWorkbook();
  return generateWorkbook({ parametros, geracaoId, signal: options.signal, caps: options.caps });
}

export async function listarTemplates(): Promise<WorkbookTemplate[]> {
  const { data, error } = await fromUntyped('workbook_templates')
    .select('*')
    .eq('ativo', true)
    .order('nome');
  if (error) throw error;
  return (data ?? []) as WorkbookTemplate[];
}

/** Template do Workbook de Fechamento (null se o modelo ainda não estiver registrado). */
export async function obterTemplateFechamento(): Promise<WorkbookTemplate | null> {
  const { data, error } = await fromUntyped('workbook_templates')
    .select('*')
    .eq('codigo', WORKBOOK_FECHAMENTO_CODIGO)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as WorkbookTemplate | null;
}

/**
 * Workbooks de fechamento gerados (modelo atual e anterior), mais recentes
 * primeiro. Geração sem arquivo guardado continua na lista: `downloadGeracao`
 * refaz o arquivo pelos parâmetros.
 */
export async function listarWorkbooksFechamento(limite = 12): Promise<WorkbookGeracao[]> {
  const { data, error } = await fromUntyped('workbook_geracoes')
    .select('*, workbook_templates!inner(nome, versao, codigo)')
    .in('workbook_templates.codigo', [WORKBOOK_FECHAMENTO_CODIGO, WORKBOOK_FECHAMENTO_V1_CODIGO])
    .eq('status', 'concluido')
    .order('created_at', { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data ?? []) as WorkbookGeracao[];
}

export async function listarGeracoes(): Promise<WorkbookGeracao[]> {
  const { data, error } = await fromUntyped('workbook_geracoes')
    .select('*, workbook_templates(nome, versao)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as WorkbookGeracao[];
}

export async function listarFechamentos(): Promise<FechamentoMensal[]> {
  const { data, error } = await fromUntyped('fechamentos_mensais')
    .select('*')
    .order('competencia', { ascending: false });
  if (error) throw error;
  return (data ?? []) as FechamentoMensal[];
}

/**
 * Generates a workbook, saves the artifact to storage, and updates the generation record.
 */
export async function gerarWorkbook(
  parametros: WorkbookParametros,
  userId: string | undefined,
  options: OpcoesGeracao = {},
): Promise<{ blob: Blob; geracaoId: string }> {
  const hash = hashParametros(parametros as unknown as Record<string, unknown>);

  // Create generation record with status 'gerando'
  const { data: geracao, error: geracaoError } = await fromUntyped('workbook_geracoes')
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
    // Generate the workbook blob
    const blob = await gerarBlob(parametros, geracao.id, options);

    // Try to save artifact to storage
    let arquivoPath: string | null = null;
    try {
      const filename = `workbook_${geracao.id}.xlsx`;
      const storagePath = `workbooks/${filename}`;
      
      const { error: uploadError } = await supabase.storage
        .from('dbavizee')
        .upload(storagePath, blob, {
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert: true,
        });
      
      if (!uploadError) {
        arquivoPath = storagePath;
      } else {
        logger.warn('Falha ao salvar artefato no storage:', uploadError.message);
      }
    } catch (storageErr) {
      logger.warn('Storage não disponível para salvar artefato:', storageErr);
    }

    // Update generation record with success
    await fromUntyped('workbook_geracoes')
      .update({
        status: 'concluido',
        arquivo_path: arquivoPath,
        updated_at: new Date().toISOString(),
      })
      .eq('id', geracao.id);

    return { blob, geracaoId: geracao.id };
  } catch (err) {
    const isAbort = err instanceof DOMException && err.name === 'AbortError';
    // Update generation record with error
    await fromUntyped('workbook_geracoes')
      .update({
        status: isAbort ? 'cancelado' : 'erro',
        observacoes: isAbort ? 'Geração cancelada pelo usuário.' : (err instanceof Error ? err.message : String(err)),
        updated_at: new Date().toISOString(),
      })
      .eq('id', geracao.id);
    throw err;
  }
}

/**
 * Downloads a previously generated workbook from storage.
 * Falls back to regeneration if the artifact is not available.
 */
export async function downloadGeracao(geracao: WorkbookGeracao): Promise<Blob> {
  // Try to download from storage first
  if (geracao.arquivo_path) {
    try {
      const { data, error } = await supabase.storage
        .from('dbavizee')
        .download(geracao.arquivo_path);
      
      if (!error && data) {
        return data;
      }
    } catch {
      logger.warn('Falha ao baixar artefato do storage, regenerando...');
    }
  }

  // Fallback: regenerate (for legacy records without saved artifacts)
  if (!geracao.parametros_json) {
    throw new Error('Parâmetros da geração não encontrados. Não é possível regenerar.');
  }

  const params = geracao.parametros_json as {
    templateId?: string;
    templateCodigo?: string;
    competenciaInicial?: string;
    competenciaFinal?: string;
    modoGeracao?: 'dinamico' | 'fechado';
  };

  return gerarBlob(
    {
      templateId: params.templateId ?? '',
      templateCodigo: params.templateCodigo,
      competenciaInicial: params.competenciaInicial ?? '',
      competenciaFinal: params.competenciaFinal ?? '',
      modoGeracao: params.modoGeracao ?? 'dinamico',
      abasSelecionadas: [],
    },
    geracao.id,
    {},
  );
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
