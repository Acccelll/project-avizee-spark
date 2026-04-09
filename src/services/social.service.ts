import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { downloadTextFile } from '@/lib/utils';
import { getSocialProvider } from './socialProviders';
import type {
  SocialAlerta,
  SocialConta,
  SocialCreateContaPayload,
  SocialDashboardConsolidado,
  SocialMetricaSnapshot,
  SocialPost,
  SocialPostFilters,
  SocialSyncPayload,
  SocialUpdateContaPayload,
} from '@/types/social';
export { socialPermissions, getSocialPermissionFlags } from '@/types/social';

function table(tableName: string) {
  return (supabase.from as unknown as (value: string) => ReturnType<typeof supabase.from>)(tableName);
}

type SocialRpcName =
  | 'social_sincronizar_manual'
  | 'social_dashboard_consolidado'
  | 'social_metricas_periodo'
  | 'social_posts_filtrados'
  | 'social_alertas_periodo';

async function socialRpc<T>(fn: SocialRpcName, params: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc as unknown as (name: string, payload: Record<string, unknown>) => Promise<{ data: T; error: Error | null }>)(fn, params);
  if (error) throw error;
  return data;
}

export async function listarContasSocial(): Promise<SocialConta[]> {
  const { data, error } = await table('social_contas')
    .select('*')
    .eq('ativo', true)
    .order('data_cadastro', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SocialConta[];
}

export async function criarContaSocial(payload: SocialCreateContaPayload): Promise<SocialConta> {
  const { data, error } = await table('social_contas').insert(payload).select('*').single();
  if (error) throw error;
  return data as SocialConta;
}

export async function atualizarContaSocial(id: string, payload: SocialUpdateContaPayload): Promise<SocialConta> {
  const { data, error } = await table('social_contas').update(payload).eq('id', id).select('*').single();
  if (error) throw error;
  return data as SocialConta;
}

export async function removerContaSocial(id: string): Promise<void> {
  const { error } = await table('social_contas').update({ ativo: false }).eq('id', id);
  if (error) throw error;
}

export async function sincronizarSocial(payload: SocialSyncPayload = {}): Promise<{ success: boolean; message: string }> {
  if (payload.contaId) {
    const { data: conta, error: contaError } = await table('social_contas').select('plataforma').eq('id', payload.contaId).single();
    if (contaError) throw contaError;
    const provider = getSocialProvider(conta?.plataforma);
    await provider.syncInsights(payload);
  }

  const data = await socialRpc<{ success: boolean; message: string }>('social_sincronizar_manual', { _conta_id: payload.contaId ?? null });
  return data;
}

export async function carregarDashboardSocial(dataInicio: string, dataFim: string): Promise<SocialDashboardConsolidado> {
  return socialRpc<SocialDashboardConsolidado>('social_dashboard_consolidado', {
    _data_inicio: dataInicio,
    _data_fim: dataFim,
  });
}

export async function listarSnapshotsPeriodo(contaId: string, dataInicio: string, dataFim: string): Promise<SocialMetricaSnapshot[]> {
  const data = await socialRpc<SocialMetricaSnapshot[]>('social_metricas_periodo', {
    _conta_id: contaId,
    _data_inicio: dataInicio,
    _data_fim: dataFim,
  });
  return data ?? [];
}

export async function listarPostsFiltrados(filtros: SocialPostFilters): Promise<SocialPost[]> {
  const data = await socialRpc<SocialPost[]>('social_posts_filtrados', {
    _plataforma: filtros.plataforma ?? null,
    _data_inicio: filtros.dataInicio,
    _data_fim: filtros.dataFim,
    _tipo_post: filtros.tipoPost ?? null,
    _campanha_id: filtros.campanhaId ?? null,
  });
  return data ?? [];
}

export async function listarAlertas(resolvido?: boolean): Promise<SocialAlerta[]> {
  const data = await socialRpc<SocialAlerta[]>('social_alertas_periodo', { _resolvido: resolvido ?? null });
  return data ?? [];
}

export interface SocialConsolidadoReportRow {
  plataforma: string;
  seguidoresNovos: number;
  engajamentoMedio: number;
  alcance: number;
  impressoes: number;
  posts: number;
}

export function buildSocialConsolidadoRows(dashboard: SocialDashboardConsolidado): SocialConsolidadoReportRow[] {
  return dashboard.comparativo.map((item) => ({
    plataforma: item.plataforma === 'instagram_business' ? 'Instagram' : 'LinkedIn',
    seguidoresNovos: Number(item.seguidores_novos || 0),
    engajamentoMedio: Number(item.taxa_engajamento_media || 0),
    alcance: Number(item.alcance || 0),
    impressoes: Number(item.impressoes || 0),
    posts: Number(item.quantidade_posts_periodo || 0),
  }));
}

export function exportSocialCsv(filename: string, rows: SocialConsolidadoReportRow[]): void {
  const headers = ['Plataforma', 'Seguidores novos', 'Engajamento médio (%)', 'Alcance', 'Impressões', 'Posts'];
  const body = rows.map((row) => [row.plataforma, row.seguidoresNovos, row.engajamentoMedio.toFixed(2), row.alcance, row.impressoes, row.posts].join(';'));
  const csv = [headers.join(';'), ...body].join('\n');
  downloadTextFile(filename, csv, 'text/csv;charset=utf-8');
}

export function exportSocialXlsx(filename: string, data: Record<string, unknown[]>): void {
  const workbook = XLSX.utils.book_new();

  Object.entries(data).forEach(([sheetName, rows]) => {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  });

  XLSX.writeFile(workbook, filename);
}
