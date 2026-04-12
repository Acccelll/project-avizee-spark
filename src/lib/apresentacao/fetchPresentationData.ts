import { supabase } from '@/integrations/supabase/client';
import type { ApresentacaoDataBundle, ApresentacaoModoGeracao, SlideCodigo } from '@/types/apresentacao';

async function queryView(viewName: string, iniYM: string, fimYM: string) {
  const q = (supabase as any).from(viewName).select('*');
  const filtered = q.gte?.('competencia', iniYM)?.lte?.('competencia', fimYM);
  const { data, error } = await (filtered ?? q);
  if (error) throw error;
  return data ?? [];
}

async function ensureClosedCoverage(iniYM: string, fimYM: string): Promise<string[]> {
  const { data, error } = await (supabase as any)
    .from('fechamentos_mensais')
    .select('id, competencia, status')
    .gte('competencia', iniYM)
    .lte('competencia', fimYM)
    .eq('status', 'fechado');
  if (error) throw error;
  const ids = (data ?? []).map((f: any) => String(f.id));
  if (!ids.length) {
    throw new Error(`Modo fechado sem cobertura para ${iniYM} até ${fimYM}.`);
  }
  return ids;
}

export async function fetchPresentationData(
  competenciaInicial: string,
  competenciaFinal: string,
  modoGeracao: ApresentacaoModoGeracao,
): Promise<ApresentacaoDataBundle> {
  const iniYM = competenciaInicial.slice(0, 7);
  const fimYM = competenciaFinal.slice(0, 7);

  if (modoGeracao === 'fechado') {
    await ensureClosedCoverage(iniYM, fimYM);
  }

  const viewMap: Record<SlideCodigo, string> = {
    cover: '',
    highlights_financeiros: 'vw_apresentacao_highlights_financeiros',
    faturamento: 'vw_apresentacao_faturamento',
    despesas: 'vw_apresentacao_despesas',
    rol_caixa: 'vw_apresentacao_rol_caixa',
    receita_vs_despesa: 'vw_apresentacao_receita_vs_despesa',
    fopag: 'vw_apresentacao_fopag',
    fluxo_caixa: 'vw_apresentacao_fluxo_caixa',
    lucro_produto_cliente: 'vw_apresentacao_lucro_produto_cliente',
    variacao_estoque: 'vw_apresentacao_variacao_estoque',
    venda_estado: 'vw_apresentacao_venda_estado',
    redes_sociais: 'vw_apresentacao_redes_sociais',
  };

  const slides = {} as ApresentacaoDataBundle['slides'];

  for (const [codigo, viewName] of Object.entries(viewMap) as Array<[SlideCodigo, string]>) {
    if (!viewName) {
      slides[codigo] = { competencia: fimYM };
      continue;
    }

    try {
      const rows = await queryView(viewName, iniYM, fimYM);
      slides[codigo] = rows[0] ?? { indisponivel: true, motivo: 'Sem dados para o período' };
    } catch {
      slides[codigo] = { indisponivel: true, motivo: 'não automatizado nesta V1' };
    }
  }

  return {
    periodo: { competenciaInicial: iniYM, competenciaFinal: fimYM },
    slides,
  };
}
