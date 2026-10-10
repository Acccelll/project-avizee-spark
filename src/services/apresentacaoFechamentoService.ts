/**
 * Apresentação de fechamento (modelo novo): dados, rascunho com as edições da
 * página, versão final e histórico. Cada competência + versão tem no máximo
 * um rascunho aberto em `apresentacao_geracoes`; "Marcar como final" congela
 * o deck (números e textos) e guarda o .pptx.
 */
import { supabase } from '@/integrations/supabase/client';
import { fromUntyped } from '@/lib/supabase/fromUntyped';
import type { ApresentacaoFechamentoDados, Deck, EdicoesDeck, VersaoApresentacao } from '@/lib/apresentacao/fechamento/tipos';

const BUCKET = 'dbavizee';
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const LOGO_URL = '/images/logoavizee.png';

export interface VersaoApresentacaoRow {
  id: string;
  competencia: string | null;
  versao: VersaoApresentacao | null;
  status: string;
  status_editorial: string;
  is_final: boolean;
  arquivo_path: string | null;
  total_slides: number | null;
  slides_json: { edicoes?: EdicoesDeck } | null;
  data_origem_json: { deck?: Deck } | null;
  competencia_inicial: string | null;
  aprovado_em: string | null;
  gerado_em: string;
  created_at: string;
  updated_at: string;
  observacoes: string | null;
}

const COLUNAS =
  'id, competencia, versao, status, status_editorial, is_final, arquivo_path, total_slides, slides_json, data_origem_json, competencia_inicial, aprovado_em, gerado_em, created_at, updated_at, observacoes';

export async function buscarDadosApresentacao(competencia: string): Promise<ApresentacaoFechamentoDados> {
  const { data, error } = await supabase.rpc('apresentacao_fechamento_dados', { p_competencia: competencia });
  if (error) throw error;
  return data as unknown as ApresentacaoFechamentoDados;
}

/** Rascunho aberto e última versão final da competência + versão. */
export async function obterTrabalho(competencia: string, versao: VersaoApresentacao): Promise<{ rascunho: VersaoApresentacaoRow | null; final: VersaoApresentacaoRow | null }> {
  const { data, error } = await fromUntyped('apresentacao_geracoes')
    .select(COLUNAS)
    .eq('competencia', competencia)
    .eq('versao', versao)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  const rows = (data ?? []) as VersaoApresentacaoRow[];
  return {
    rascunho: rows.find((r) => !r.is_final) ?? null,
    final: rows.find((r) => r.is_final) ?? null,
  };
}

async function usuarioAtual(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Grava as edições no rascunho da competência + versão (cria o rascunho na primeira edição). */
export async function salvarEdicoes(competencia: string, versao: VersaoApresentacao, edicoes: EdicoesDeck, rascunhoId?: string | null): Promise<string> {
  const agora = new Date().toISOString();
  if (rascunhoId) {
    const { error } = await fromUntyped('apresentacao_geracoes')
      .update({ slides_json: { edicoes }, updated_at: agora })
      .eq('id', rascunhoId);
    if (error) throw error;
    return rascunhoId;
  }
  const { data, error } = await fromUntyped('apresentacao_geracoes')
    .insert({
      competencia,
      versao,
      template_id: null,
      competencia_inicial: `${competencia}-01`,
      competencia_final: `${competencia}-01`,
      modo_geracao: 'fechado',
      status: 'concluido',
      status_editorial: 'rascunho',
      is_final: false,
      slides_json: { edicoes },
      parametros_json: { competencia, versao, modelo: 'fechamento_v3' },
      gerado_por: await usuarioAtual(),
      gerado_em: agora,
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/**
 * Congela a versão: guarda o deck (números e textos) e o .pptx, e marca o
 * rascunho como final. Sem rascunho, cria o registro já como final.
 */
export async function marcarComoFinal(deck: Deck, edicoes: EdicoesDeck, arquivo: Blob, rascunhoId?: string | null): Promise<string> {
  const id = rascunhoId ?? (await salvarEdicoes(deck.competencia, deck.versao, edicoes, null));
  const path = `apresentacoes/fechamento_${deck.competencia}_${deck.versao}_${id}.pptx`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, arquivo, { upsert: true, contentType: PPTX_MIME });
  if (upErr) throw upErr;
  const agora = new Date().toISOString();
  const { error } = await fromUntyped('apresentacao_geracoes')
    .update({
      is_final: true,
      status: 'concluido',
      status_editorial: 'aprovado',
      aprovado_por: await usuarioAtual(),
      aprovado_em: agora,
      arquivo_path: path,
      total_slides: deck.slides.length,
      slides_json: { edicoes },
      data_origem_json: { deck },
      updated_at: agora,
    })
    .eq('id', id);
  if (error) throw error;
  return id;
}

/** Abre um rascunho novo a partir de uma versão final (mantém as edições dela). */
export async function reabrirRascunho(final: VersaoApresentacaoRow): Promise<string> {
  if (!final.competencia || !final.versao) throw new Error('Versão sem competência.');
  return salvarEdicoes(final.competencia, final.versao, final.slides_json?.edicoes ?? {}, null);
}

/** Versões finais (do modelo novo e do antigo) para o histórico. */
export async function listarHistorico(): Promise<VersaoApresentacaoRow[]> {
  const { data, error } = await fromUntyped('apresentacao_geracoes')
    .select(COLUNAS)
    .eq('status', 'concluido')
    .not('arquivo_path', 'is', null)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) throw error;
  return (data ?? []) as VersaoApresentacaoRow[];
}

export async function baixarArquivo(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw error ?? new Error('Arquivo não encontrado.');
  return data;
}

function lerComoDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Logo da marca: o original para a capa e uma cópia pequena para o rodapé. */
async function carregarLogo(): Promise<{ logoDataUrl?: string; logoRodapeDataUrl?: string; logoProporcao?: number }> {
  try {
    const resp = await fetch(LOGO_URL);
    if (!resp.ok) return {};
    const logoDataUrl = await lerComoDataUrl(await resp.blob());
    const img = new Image();
    await new Promise<void>((ok, erro) => { img.onload = () => ok(); img.onerror = () => erro(new Error('logo')); img.src = logoDataUrl; });
    const proporcao = img.naturalWidth / img.naturalHeight;
    const canvas = document.createElement('canvas');
    canvas.height = 96;
    canvas.width = Math.round(96 * proporcao);
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { logoDataUrl, logoRodapeDataUrl: canvas.toDataURL('image/png'), logoProporcao: proporcao };
  } catch {
    return {};
  }
}

/** Gera o .pptx do deck (o gerador é carregado sob demanda). */
export async function gerarArquivoDeck(deck: Deck): Promise<Blob> {
  const [{ gerarPptx }, logo] = await Promise.all([import('@/lib/apresentacao/fechamento/pptx'), carregarLogo()]);
  return (await gerarPptx(deck, logo, 'blob')) as Blob;
}

export function baixarBlob(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
