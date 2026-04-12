import { supabase } from '@/integrations/supabase/client';
import type {
  ApresentacaoTemplate,
  ApresentacaoGeracao,
  ApresentacaoComentario,
  ApresentacaoParametros,
  TemplateConfig,
} from '@/types/apresentacao';
import { fetchPresentationData } from '@/lib/apresentacao/fetchPresentationData';
import { gerarComentariosAutomaticos } from '@/lib/apresentacao/commentRules';
import { generatePresentation } from '@/lib/apresentacao/generatePresentation';
import { hashParametros, serializeToJsonb } from '@/lib/apresentacao/utils';
import { validateTemplateConfig } from '@/lib/apresentacao/templateConfig';

// -------------------------------------------------------
// Template queries
// -------------------------------------------------------

export async function listarApresentacaoTemplates(): Promise<ApresentacaoTemplate[]> {
  const { data, error } = await (supabase as any)
    .from('apresentacao_templates')
    .select('*')
    .eq('ativo', true)
    .order('nome');
  if (error) throw error;
  return (data ?? []) as ApresentacaoTemplate[];
}

export async function listarTodosApresentacaoTemplates(): Promise<ApresentacaoTemplate[]> {
  const { data, error } = await (supabase as any)
    .from('apresentacao_templates')
    .select('*')
    .order('nome');
  if (error) throw error;
  return (data ?? []) as ApresentacaoTemplate[];
}

export async function criarTemplate(
  input: Pick<ApresentacaoTemplate, 'nome' | 'codigo' | 'versao' | 'descricao'> & {
    config_json?: TemplateConfig | null;
  }
): Promise<ApresentacaoTemplate> {
  const validation = validateTemplateConfig(input.config_json);
  if (!validation.valid) {
    throw new Error(`config_json inválido: ${validation.errors.join('; ')}`);
  }
  const { data, error } = await (supabase as any)
    .from('apresentacao_templates')
    .insert({
      nome: input.nome,
      codigo: input.codigo,
      versao: input.versao,
      descricao: input.descricao ?? null,
      config_json: input.config_json ?? null,
      ativo: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ApresentacaoTemplate;
}

export async function atualizarTemplate(
  id: string,
  input: Partial<Pick<ApresentacaoTemplate, 'nome' | 'descricao' | 'ativo' | 'versao'>> & {
    config_json?: TemplateConfig | null;
  }
): Promise<ApresentacaoTemplate> {
  if ('config_json' in input) {
    const validation = validateTemplateConfig(input.config_json);
    if (!validation.valid) {
      throw new Error(`config_json inválido: ${validation.errors.join('; ')}`);
    }
  }
  const { data, error } = await (supabase as any)
    .from('apresentacao_templates')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as ApresentacaoTemplate;
}

export async function desativarTemplate(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('apresentacao_templates')
    .update({ ativo: false, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function duplicarTemplate(
  sourceId: string,
  novoCodigo: string,
  novaVersao: string = 'v1'
): Promise<ApresentacaoTemplate> {
  const { data: source, error: fetchError } = await (supabase as any)
    .from('apresentacao_templates')
    .select('*')
    .eq('id', sourceId)
    .single();
  if (fetchError) throw fetchError;
  const src = source as ApresentacaoTemplate;
  return criarTemplate({
    nome: `${src.nome} (cópia)`,
    codigo: novoCodigo,
    versao: novaVersao,
    descricao: src.descricao,
    config_json: src.config_json,
  });
}

// -------------------------------------------------------
// Generation history queries
// -------------------------------------------------------

export async function listarApresentacaoGeracoes(): Promise<ApresentacaoGeracao[]> {
  const { data, error } = await (supabase as any)
    .from('apresentacao_geracoes')
    .select('*, apresentacao_templates(nome, versao, codigo)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as ApresentacaoGeracao[];
}

// -------------------------------------------------------
// Comment queries
// -------------------------------------------------------

export async function listarComentariosByGeracao(
  geracaoId: string
): Promise<ApresentacaoComentario[]> {
  const { data, error } = await (supabase as any)
    .from('apresentacao_comentarios')
    .select('*')
    .eq('geracao_id', geracaoId)
    .order('ordem');
  if (error) throw error;
  return (data ?? []) as ApresentacaoComentario[];
}

export async function atualizarComentarioEditado(
  comentarioId: string,
  comentarioEditado: string
): Promise<void> {
  const { error } = await (supabase as any)
    .from('apresentacao_comentarios')
    .update({ comentario_editado: comentarioEditado, updated_at: new Date().toISOString() })
    .eq('id', comentarioId);
  if (error) throw error;
}

// -------------------------------------------------------
// Main generation orchestrator
// -------------------------------------------------------

export async function gerarApresentacao(
  parametros: ApresentacaoParametros,
  userId: string | undefined,
  empresaNome?: string
): Promise<{ blob: Blob; geracaoId: string }> {
  const hash = hashParametros(serializeToJsonb(parametros));

  // Fetch template to get config_json
  const { data: templateData, error: templateError } = await (supabase as any)
    .from('apresentacao_templates')
    .select('*')
    .eq('id', parametros.templateId)
    .single();
  if (templateError) throw templateError;
  const template = templateData as import('@/types/apresentacao').ApresentacaoTemplate;

  // Create generation record
  const { data: geracao, error: geracaoError } = await (supabase as any)
    .from('apresentacao_geracoes')
    .insert({
      template_id: parametros.templateId,
      competencia_inicial: parametros.competenciaInicial + '-01',
      competencia_final: parametros.competenciaFinal + '-01',
      modo_geracao: parametros.modoGeracao,
      status: 'gerando',
      status_editorial: 'rascunho',
      hash_geracao: hash,
      parametros_json: serializeToJsonb(parametros),
      gerado_por: userId ?? null,
    })
    .select()
    .single();
  if (geracaoError) throw geracaoError;

  try {
    // Fetch analytical data
    const data = await fetchPresentationData(
      parametros.competenciaInicial,
      parametros.competenciaFinal,
      parametros.modoGeracao
    );

    // Generate automatic comments
    const comentariosInput = gerarComentariosAutomaticos(
      data,
      parametros.competenciaInicial,
      parametros.competenciaFinal
    );

    // Persist comments (V2: include prioridade and comentario_status)
    const comentariosToInsert = comentariosInput.map((c) => ({
      geracao_id: geracao.id,
      slide_codigo: c.codigo,
      titulo: c.titulo,
      comentario_automatico: c.comentario_automatico,
      comentario_editado: null,
      origem: 'automatico',
      ordem: c.ordem,
      prioridade: c.prioridade ?? 1,
      comentario_status: 'automatico',
    }));
    await (supabase as any).from('apresentacao_comentarios').insert(comentariosToInsert);

    // Load comments back (so we have IDs)
    const comentarios = await listarComentariosByGeracao(geracao.id);

    // Generate PPTX blob
    const blob = await generatePresentation({
      parametros,
      geracaoId: geracao.id,
      data,
      comentarios,
      empresaNome,
      templateConfig: template.config_json ?? null,
    });

    // Compute total slides for history enrichment
    const { resolveSlides } = await import('@/lib/apresentacao/templateConfig');
    const activeSlides = resolveSlides(template.config_json ?? null);
    const totalSlides = activeSlides.filter((s) => s.ativo).length;

    // Save artifact to Supabase Storage
    let arquivoPath: string | null = null;
    try {
      const storagePath = `apresentacoes/apresentacao_${geracao.id}.pptx`;
      const { error: uploadError } = await supabase.storage
        .from('dbavizee')
        .upload(storagePath, blob, {
          contentType:
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          upsert: true,
        });
      if (!uploadError) {
        arquivoPath = storagePath;
      } else {
        console.warn('Falha ao salvar artefato da apresentação no storage:', uploadError.message);
      }
    } catch (storageErr) {
      console.warn('Storage não disponível para apresentação:', storageErr);
    }

    // Mark as completed with V2 fields
    await (supabase as any)
      .from('apresentacao_geracoes')
      .update({
        status: 'concluido',
        status_editorial: 'revisao',
        arquivo_path: arquivoPath,
        total_slides: totalSlides,
        slides_config_json: activeSlides as unknown as Record<string, unknown>[],
        updated_at: new Date().toISOString(),
      })
      .eq('id', geracao.id);

    return { blob, geracaoId: geracao.id };
  } catch (err) {
    await (supabase as any)
      .from('apresentacao_geracoes')
      .update({
        status: 'erro',
        observacoes: err instanceof Error ? err.message : String(err),
        updated_at: new Date().toISOString(),
      })
      .eq('id', geracao.id);
    throw err;
  }
}

// -------------------------------------------------------
// Download saved artifact
// -------------------------------------------------------

export async function downloadApresentacaoGeracao(
  geracao: ApresentacaoGeracao
): Promise<Blob> {
  if (!geracao.arquivo_path) {
    throw new Error(
      'Esta geração não possui arquivo salvo. Regenere a apresentação para obter o arquivo.'
    );
  }
  const { data, error } = await supabase.storage
    .from('dbavizee')
    .download(geracao.arquivo_path);
  if (error) throw error;
  return data;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// -------------------------------------------------------
// V2 — Editorial workflow: approve / reject
// -------------------------------------------------------

/**
 * Approves a generation, transitioning status_editorial → aprovado.
 * Records the approver user and timestamp.
 */
export async function aprovarGeracao(
  geracaoId: string,
  userId: string
): Promise<void> {
  const { error } = await (supabase as any)
    .from('apresentacao_geracoes')
    .update({
      status_editorial: 'aprovado',
      aprovado_por: userId,
      aprovado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', geracaoId);
  if (error) throw error;
}

/**
 * Rejects / returns a generation to rascunho status so comments can be edited.
 */
export async function rejeitarGeracao(geracaoId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('apresentacao_geracoes')
    .update({
      status_editorial: 'rascunho',
      aprovado_por: null,
      aprovado_em: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', geracaoId);
  if (error) throw error;
}

/**
 * Updates the status of a single comment (automatico / editado / aprovado).
 */
export async function atualizarStatusComentario(
  comentarioId: string,
  status: import('@/types/apresentacao').ComentarioStatus
): Promise<void> {
  const { error } = await (supabase as any)
    .from('apresentacao_comentarios')
    .update({ comentario_status: status, updated_at: new Date().toISOString() })
    .eq('id', comentarioId);
  if (error) throw error;
}

/**
 * Updates a comment's edited text AND marks it as editado.
 */
export async function atualizarComentarioEditadoV2(
  comentarioId: string,
  comentarioEditado: string
): Promise<void> {
  const { error } = await (supabase as any)
    .from('apresentacao_comentarios')
    .update({
      comentario_editado: comentarioEditado,
      comentario_status: 'editado',
      updated_at: new Date().toISOString(),
    })
    .eq('id', comentarioId);
  if (error) throw error;
}
