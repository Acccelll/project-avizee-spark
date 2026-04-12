import { supabase } from '@/integrations/supabase/client';
import type {
  ApresentacaoComentario,
  ApresentacaoGeracao,
  ApresentacaoModoGeracao,
  ApresentacaoParametros,
  ApresentacaoTemplate,
  SlideCodigo,
} from '@/types/apresentacao';
import { fetchPresentationData } from '@/lib/apresentacao/fetchPresentationData';
import { generatePresentation } from '@/lib/apresentacao/generatePresentation';
import { buildAutomaticComment } from '@/lib/apresentacao/commentRules';
import { APRESENTACAO_SLIDES_V1 } from '@/lib/apresentacao/slideDefinitions';
import { hashPayload } from '@/lib/apresentacao/utils';

export async function listarApresentacaoTemplates(): Promise<ApresentacaoTemplate[]> {
  const { data, error } = await (supabase as any).from('apresentacao_templates').select('*').eq('ativo', true).order('nome');
  if (error) throw error;
  return (data ?? []) as ApresentacaoTemplate[];
}

export async function incluirTemplateApresentacao(input: {
  nome: string;
  codigo: string;
  versao: string;
  descricao?: string;
  arquivo?: File;
}): Promise<ApresentacaoTemplate> {
  let arquivoPath: string | null = null;

  if (input.arquivo) {
    const filename = `${input.codigo.toLowerCase()}_${input.versao.replace(/\s+/g, '_')}.pptx`;
    arquivoPath = `templates/apresentacao/${filename}`;
    const { error: uploadError } = await supabase.storage
      .from('dbavizee')
      .upload(arquivoPath, input.arquivo, {
        upsert: true,
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      });
    if (uploadError) throw uploadError;
  }

  const { data, error } = await (supabase as any)
    .from('apresentacao_templates')
    .insert({
      nome: input.nome,
      codigo: input.codigo,
      versao: input.versao,
      descricao: input.descricao ?? null,
      arquivo_path: arquivoPath,
      config_json: { origem: 'manual', layout: 'apresentacao_v1' },
      ativo: true,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as ApresentacaoTemplate;
}

export async function listarApresentacaoGeracoes(): Promise<ApresentacaoGeracao[]> {
  const { data, error } = await (supabase as any)
    .from('apresentacao_geracoes')
    .select('*, apresentacao_templates(nome, versao)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as ApresentacaoGeracao[];
}

export async function listarComentarios(geracaoId: string): Promise<ApresentacaoComentario[]> {
  const { data, error } = await (supabase as any)
    .from('apresentacao_comentarios')
    .select('*')
    .eq('geracao_id', geracaoId)
    .order('ordem');
  if (error) throw error;
  return (data ?? []) as ApresentacaoComentario[];
}

export async function atualizarComentario(id: string, comentario_editado: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('apresentacao_comentarios')
    .update({ comentario_editado, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function gerarApresentacao(params: ApresentacaoParametros, userId?: string) {
  const hash = hashPayload(params);
  const { data: geracao, error: geracaoError } = await (supabase as any)
    .from('apresentacao_geracoes')
    .insert({
      template_id: params.templateId,
      empresa_id: params.empresaId ?? null,
      competencia_inicial: `${params.competenciaInicial}-01`,
      competencia_final: `${params.competenciaFinal}-01`,
      modo_geracao: params.modoGeracao,
      status: 'gerando',
      hash_geracao: hash,
      parametros_json: params,
      gerado_por: userId ?? null,
    })
    .select('*')
    .single();
  if (geracaoError) throw geracaoError;

  try {
    const bundle = await fetchPresentationData(`${params.competenciaInicial}-01`, `${params.competenciaFinal}-01`, params.modoGeracao);

    const comentarios = APRESENTACAO_SLIDES_V1.map((slide, ordem) => ({
      geracao_id: geracao.id,
      slide_codigo: slide.codigo,
      titulo: slide.titulo,
      comentario_automatico: buildAutomaticComment(slide.codigo, bundle.slides[slide.codigo] ?? {}),
      comentario_editado: null,
      origem: params.modoGeracao,
      ordem,
    }));

    await (supabase as any).from('apresentacao_comentarios').insert(comentarios);

    const blob = await generatePresentation(bundle, {});
    const arquivoPath = `apresentacoes/apresentacao_${geracao.id}.pptx`;

    const { error: uploadError } = await supabase.storage
      .from('dbavizee')
      .upload(arquivoPath, blob, {
        upsert: true,
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      });

    if (uploadError) throw uploadError;

    await (supabase as any)
      .from('apresentacao_geracoes')
      .update({ status: 'concluido', arquivo_path: arquivoPath, updated_at: new Date().toISOString() })
      .eq('id', geracao.id);

    return { geracaoId: geracao.id as string, blob };
  } catch (err) {
    await (supabase as any)
      .from('apresentacao_geracoes')
      .update({ status: 'erro', observacoes: err instanceof Error ? err.message : String(err) })
      .eq('id', geracao.id);
    throw err;
  }
}

export async function regenerarComComentariosEditados(geracaoId: string): Promise<Blob> {
  const { data: geracao } = await (supabase as any).from('apresentacao_geracoes').select('*').eq('id', geracaoId).single();
  if (!geracao?.parametros_json) throw new Error('Geração sem parâmetros.');

  const p = geracao.parametros_json as {
    competenciaInicial: string;
    competenciaFinal: string;
    modoGeracao: ApresentacaoModoGeracao;
  };

  const comentarios = await listarComentarios(geracaoId);
  const comentarioMap = comentarios.reduce((acc, c) => {
    acc[c.slide_codigo as SlideCodigo] = c.comentario_editado ?? undefined;
    return acc;
  }, {} as Partial<Record<SlideCodigo, string | undefined>>);

  const bundle = await fetchPresentationData(`${p.competenciaInicial}-01`, `${p.competenciaFinal}-01`, p.modoGeracao);
  return generatePresentation(bundle, comentarioMap as Partial<Record<string, string>>);
}

export async function downloadApresentacao(geracao: ApresentacaoGeracao): Promise<Blob> {
  if (!geracao.arquivo_path) throw new Error('Arquivo não encontrado no histórico.');
  const { data, error } = await supabase.storage.from('dbavizee').download(geracao.arquivo_path);
  if (error || !data) throw error ?? new Error('Falha no download do storage.');
  return data;
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
