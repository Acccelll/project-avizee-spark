import { supabase } from '@/integrations/supabase/client';
import type { ApresentacaoDataBundle, ApresentacaoModoGeracao, SlideCodigo } from '@/types/apresentacao';
import { APRESENTACAO_SLIDES_MAP } from './slideDefinitions';

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
  if (!ids.length) throw new Error(`Modo fechado sem cobertura para ${iniYM} até ${fimYM}.`);
  return ids;
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
  bridge_ebitda: 'vw_apresentacao_bridge_ebitda',
  bridge_lucro_liquido: 'vw_apresentacao_bridge_lucro_liquido',
  dre_gerencial: 'vw_apresentacao_dre_gerencial',
  capital_giro: 'vw_apresentacao_capital_giro',
  balanco_gerencial: 'vw_apresentacao_balanco_gerencial',
  resultado_financeiro: 'vw_apresentacao_resultado_financeiro',
  tributos: 'vw_apresentacao_tributos',
  aging_consolidado: 'vw_apresentacao_aging_consolidado',
  debt: 'vw_apresentacao_debt',
  bancos_detalhado: 'vw_apresentacao_bancos_detalhado',
  backorder: 'vw_apresentacao_backorder',
  top_clientes: 'vw_apresentacao_top_clientes',
  top_fornecedores: 'vw_apresentacao_top_fornecedores',
  inadimplencia: 'vw_apresentacao_inadimplencia',
  performance_comercial_canal: 'vw_apresentacao_performance_comercial_canal',
  closing: '',
};

export async function fetchPresentationData(
  competenciaInicial: string,
  competenciaFinal: string,
  modoGeracao: ApresentacaoModoGeracao,
  requestedSlides?: SlideCodigo[],
): Promise<ApresentacaoDataBundle> {
  const iniYM = competenciaInicial.slice(0, 7);
  const fimYM = competenciaFinal.slice(0, 7);

  if (modoGeracao === 'fechado') {
    await ensureClosedCoverage(iniYM, fimYM);
  }

  const slidesList = requestedSlides?.length ? requestedSlides : Object.keys(viewMap) as SlideCodigo[];
  const slides = {} as ApresentacaoDataBundle['slides'];
  const missingCritical: SlideCodigo[] = [];

  for (const codigo of slidesList) {
    const viewName = viewMap[codigo];
    if (!viewName) {
      slides[codigo] = { competencia: fimYM, indisponivel: false };
      continue;
    }

    try {
      const rows = await queryView(viewName, iniYM, fimYM);
      const row = rows[0] ?? { indisponivel: true, motivo: 'Sem dados para o período' };
      slides[codigo] = row;

      const def = APRESENTACAO_SLIDES_MAP.get(codigo);
      if (modoGeracao === 'fechado' && def?.criticalInClosedMode && row.indisponivel) {
        missingCritical.push(codigo);
      }
    } catch {
      slides[codigo] = { indisponivel: true, motivo: 'não automatizado nesta fase' };
      const def = APRESENTACAO_SLIDES_MAP.get(codigo);
      if (modoGeracao === 'fechado' && def?.criticalInClosedMode) missingCritical.push(codigo);
    }
  }

  if (modoGeracao === 'fechado' && missingCritical.length) {
    throw new Error(`Modo fechado sem snapshots/visões críticas para: ${missingCritical.join(', ')}`);
  }

  return {
    periodo: { competenciaInicial: iniYM, competenciaFinal: fimYM },
    slides,
    missingCritical,
  };
}
