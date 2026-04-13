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

function monthRange(iniYM: string, fimYM: string): string[] {
  const [iniY, iniM] = iniYM.split('-').map(Number);
  const [fimY, fimM] = fimYM.split('-').map(Number);
  const out: string[] = [];
  let y = iniY;
  let m = iniM;
  while (y < fimY || (y === fimY && m <= fimM)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
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

async function fetchClosedSnapshotData(iniYM: string, fimYM: string, slidesList: SlideCodigo[]) {
  const { data: fechamentoData, error: fechamentoError } = await (supabase as any)
    .from('fechamentos_mensais')
    .select('id, competencia, status')
    .gte('competencia', `${iniYM}-01`)
    .lte('competencia', `${fimYM}-31`)
    .eq('status', 'fechado');
  if (fechamentoError) throw fechamentoError;
  const fechamentos = (fechamentoData ?? []).map((f: any) => ({ id: String(f.id), competencia: String(f.competencia).slice(0, 7) }));
  const expected = monthRange(iniYM, fimYM);
  const missing = expected.filter((m) => !fechamentos.some((f) => f.competencia === m));
  if (missing.length) throw new Error(`Modo fechado sem cobertura completa: ${missing.join(', ')}`);

  const fechamentoIds = fechamentos.map((f) => f.id);
  const competenciaByFechamentoId = new Map(fechamentos.map((f) => [f.id, f.competencia]));

  const [finRes, caixaRes, estoqueRes, fopagRes] = await Promise.all([
    (supabase as any).from('fechamento_financeiro_saldos').select('*').in('fechamento_id', fechamentoIds),
    (supabase as any).from('fechamento_caixa_saldos').select('*').in('fechamento_id', fechamentoIds),
    (supabase as any).from('fechamento_estoque_saldos').select('*').in('fechamento_id', fechamentoIds),
    (supabase as any).from('fechamento_fopag_resumo').select('*').in('fechamento_id', fechamentoIds),
  ]);

  const fin = finRes.data ?? [];
  const caixa = caixaRes.data ?? [];
  const estoque = estoqueRes.data ?? [];
  const fopag = fopagRes.data ?? [];

  const byComp = <T extends { fechamento_id?: string }>(rows: T[]) => {
    const map = new Map<string, T[]>();
    rows.forEach((row) => {
      const fechamentoId = String(row.fechamento_id ?? '');
      const comp = competenciaByFechamentoId.get(fechamentoId) ?? '';
      if (!comp) return;
      if (!map.has(comp)) map.set(comp, []);
      map.get(comp)!.push(row);
    });
    return map;
  };

  const finMap = byComp(fin as any);
  const caixaMap = byComp(caixa as any);
  const estoqueMap = byComp(estoque as any);
  const fopagMap = byComp(fopag as any);

  const selectedComp = fimYM;
  const slides = {} as Record<SlideCodigo, Record<string, unknown>>;

  for (const codigo of slidesList) {
    if (codigo === 'cover' || codigo === 'closing') {
      slides[codigo] = { competencia: selectedComp, indisponivel: false };
      continue;
    }

    if (['rol_caixa', 'fluxo_caixa', 'bancos_detalhado'].includes(codigo)) {
      const rows = caixaMap.get(selectedComp) ?? [];
      if (!rows.length) {
        slides[codigo] = { indisponivel: true, motivo: 'snapshot caixa indisponível' };
        continue;
      }
      const total = rows.reduce((acc, r: any) => acc + Number(r.saldo_final ?? 0), 0);
      slides[codigo] = {
        competencia: selectedComp,
        valor_atual: total,
        total_entradas: rows.reduce((acc, r: any) => acc + Number(r.total_entradas ?? 0), 0),
        total_saidas: rows.reduce((acc, r: any) => acc + Number(r.total_saidas ?? 0), 0),
      };
      continue;
    }

    if (codigo === 'variacao_estoque') {
      const rows = estoqueMap.get(selectedComp) ?? [];
      if (!rows.length) {
        slides[codigo] = { indisponivel: true, motivo: 'snapshot estoque indisponível' };
        continue;
      }
      slides[codigo] = {
        competencia: selectedComp,
        valor_atual: rows.reduce((acc: number, r: any) => acc + Number(r.valor_total ?? 0), 0),
        quantidade_itens: rows.length,
        custo_unitario_medio: rows.length
          ? rows.reduce((acc: number, r: any) => acc + Number(r.custo_unitario ?? 0), 0) / rows.length
          : 0,
      };
      continue;
    }

    if (codigo === 'fopag') {
      const rows = fopagMap.get(selectedComp) ?? [];
      if (!rows.length) {
        slides[codigo] = { indisponivel: true, motivo: 'snapshot fopag indisponível' };
        continue;
      }
      slides[codigo] = {
        competencia: selectedComp,
        valor_atual: rows.reduce((acc: number, r: any) => acc + Number(r.valor_liquido ?? 0), 0),
        funcionarios: rows.length,
      };
      continue;
    }

    if (codigo === 'aging_consolidado') {
      const rows = finMap.get(selectedComp) ?? [];
      if (!rows.length) {
        slides[codigo] = { indisponivel: true, motivo: 'snapshot financeiro indisponível' };
        continue;
      }
      const receita = rows.filter((r: any) => r.tipo === 'receber').reduce((a: number, r: any) => a + Number(r.saldo_aberto ?? 0), 0);
      const despesa = rows.filter((r: any) => r.tipo === 'pagar').reduce((a: number, r: any) => a + Number(r.saldo_aberto ?? 0), 0);
      slides[codigo] = {
        competencia: selectedComp,
        cr_aberto: receita,
        cp_aberto: despesa,
        valor_atual: receita + despesa,
      };
      continue;
    }

    if (codigo === 'capital_giro') {
      const rows = finMap.get(selectedComp) ?? [];
      if (!rows.length) {
        slides[codigo] = { indisponivel: true, motivo: 'snapshot financeiro indisponível' };
        continue;
      }
      const contasReceber = rows.filter((r: any) => r.tipo === 'receber').reduce((a: number, r: any) => a + Number(r.saldo_aberto ?? 0), 0);
      const contasPagar = rows.filter((r: any) => r.tipo === 'pagar').reduce((a: number, r: any) => a + Number(r.saldo_aberto ?? 0), 0);
      slides[codigo] = {
        competencia: selectedComp,
        contas_receber: contasReceber,
        contas_pagar: contasPagar,
        valor_atual: contasReceber - contasPagar,
      };
      continue;
    }

    if (['highlights_financeiros', 'receita_vs_despesa', 'despesas', 'faturamento', 'inadimplencia', 'balanco_gerencial', 'debt'].includes(codigo)) {
      slides[codigo] = { indisponivel: true, motivo: 'não automatizado no modo fechado' };
      continue;
    }

    // Demais slides dependem de bases não snapshotadas atualmente
    slides[codigo] = { indisponivel: true, motivo: 'não automatizado no modo fechado' };
  }

  return slides;
}

export async function fetchPresentationData(
  competenciaInicial: string,
  competenciaFinal: string,
  modoGeracao: ApresentacaoModoGeracao,
  requestedSlides?: SlideCodigo[],
): Promise<ApresentacaoDataBundle> {
  const iniYM = competenciaInicial.slice(0, 7);
  const fimYM = competenciaFinal.slice(0, 7);
  const slidesList = requestedSlides?.length ? requestedSlides : Object.keys(viewMap) as SlideCodigo[];

  const slides = modoGeracao === 'fechado'
    ? await fetchClosedSnapshotData(iniYM, fimYM, slidesList)
    : ({} as ApresentacaoDataBundle['slides']);

  if (modoGeracao === 'dinamico') {
    for (const codigo of slidesList) {
      const viewName = viewMap[codigo];
      if (!viewName) {
        slides[codigo] = { competencia: fimYM, indisponivel: false };
        continue;
      }

      try {
        const rows = await queryView(viewName, iniYM, fimYM);
        slides[codigo] = rows[0] ?? { indisponivel: true, motivo: 'Sem dados para o período' };
      } catch {
        slides[codigo] = { indisponivel: true, motivo: 'não automatizado nesta fase' };
      }
    }
  }

  const missingCritical: SlideCodigo[] = [];
  for (const codigo of slidesList) {
    const def = APRESENTACAO_SLIDES_MAP.get(codigo);
    const row = slides[codigo] ?? { indisponivel: true };
    if (modoGeracao === 'fechado' && def?.criticalInClosedMode && row.indisponivel) {
      missingCritical.push(codigo);
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
