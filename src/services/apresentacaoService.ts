import { supabase } from '@/integrations/supabase/client';
import type {
  ApresentacaoTemplate,
  ApresentacaoGeracao,
  ApresentacaoParametros,
  ApresentacaoComentario
} from '@/types/apresentacao';
import { generatePresentation } from '@/lib/apresentacao/generatePresentation';
import { fetchPresentationData } from '@/lib/apresentacao/fetchPresentationData';
import { generateAutomaticComments } from '@/lib/apresentacao/commentRules';

export async function listarTemplates(): Promise<ApresentacaoTemplate[]> {
  const { data, error } = await supabase
    .from('apresentacao_templates')
    .select('*')
    .eq('ativo', true)
    .order('nome');
  if (error) throw error;
  return (data ?? []) as ApresentacaoTemplate[];
}

export async function listarGeracoes(): Promise<ApresentacaoGeracao[]> {
  const { data, error } = await supabase
    .from('apresentacao_geracoes')
    .select('*, apresentacao_templates(nome, versao)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as ApresentacaoGeracao[];
}

export async function buscarComentarios(geracaoId: string): Promise<ApresentacaoComentario[]> {
  const { data, error } = await supabase
    .from('apresentacao_comentarios')
    .select('*')
    .eq('geracao_id', geracaoId)
    .order('ordem');
  if (error) throw error;
  return (data ?? []) as ApresentacaoComentario[];
}

export async function salvarComentario(comentario: Partial<ApresentacaoComentario>): Promise<void> {
  const { error } = await supabase
    .from('apresentacao_comentarios')
    .upsert(comentario);
  if (error) throw error;
}

export async function iniciarGeracao(parametros: ApresentacaoParametros, userId?: string): Promise<ApresentacaoGeracao> {
  const { data, error } = await supabase
    .from('apresentacao_geracoes')
    .insert({
      template_id: parametros.templateId,
      empresa_id: parametros.empresaId,
      competencia_inicial: parametros.competenciaInicial + '-01',
      competencia_final: parametros.competenciaFinal + '-01',
      modo_geracao: parametros.modoGeracao,
      status: 'pendente',
      parametros_json: parametros as any,
      gerado_por: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ApresentacaoGeracao;
}

export async function processarGeracao(geracaoId: string): Promise<void> {
  const { data: geracao, error: fetchError } = await supabase
    .from('apresentacao_geracoes')
    .select('*')
    .eq('id', geracaoId)
    .single();

  if (fetchError || !geracao) throw fetchError || new Error('Geração não encontrada');

  await supabase.from('apresentacao_geracoes').update({ status: 'gerando' }).eq('id', geracaoId);

  try {
    const params = geracao.parametros_json as unknown as ApresentacaoParametros;
    const data = await fetchPresentationData(params.competenciaInicial, params.competenciaFinal, params.modoGeracao);

    // Gerar comentários automáticos se não existirem
    const { data: existingComments } = await supabase
      .from('apresentacao_comentarios')
      .select('id')
      .eq('geracao_id', geracaoId);

    if (!existingComments || existingComments.length === 0) {
      const autoComments = generateAutomaticComments(data, params);
      const commentsToInsert = autoComments.map((c, index) => ({
        geracao_id: geracaoId,
        slide_codigo: c.slide_codigo,
        titulo: c.titulo,
        comentario_automatico: c.comentario,
        ordem: index
      }));
      await supabase.from('apresentacao_comentarios').insert(commentsToInsert);
    }

    // Buscar comentários (agora com os automáticos inseridos ou os editados previamente)
    const comentarios = await buscarComentarios(geracaoId);

    // Buscar configuração do template
    const { data: template } = await supabase
      .from('apresentacao_templates')
      .select('config_json')
      .eq('id', params.templateId)
      .single();

    const blob = await generatePresentation(data, params, comentarios, template?.config_json);

    const filename = `apresentacao_${geracaoId}.pptx`;
    const storagePath = `apresentacoes/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from('dbavizee')
      .upload(storagePath, blob, {
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    await supabase.from('apresentacao_geracoes').update({
      status: 'concluido',
      arquivo_path: storagePath,
      updated_at: new Date().toISOString()
    }).eq('id', geracaoId);

  } catch (error) {
    console.error('Erro ao processar apresentação:', error);
    await supabase.from('apresentacao_geracoes').update({
      status: 'erro',
      observacoes: error instanceof Error ? error.message : String(error),
      updated_at: new Date().toISOString()
    }).eq('id', geracaoId);
    throw error;
  }
}

export async function downloadApresentacao(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage
    .from('dbavizee')
    .download(path);
  if (error) throw error;
  return data;
}
