/**
 * Fetches all data needed for workbook generation.
 * Uses vw_workbook_* views when available, falls back to direct queries.
 * Supports both dynamic (live) and closed (snapshot) modes.
 */
import { supabase } from '@/integrations/supabase/client';
import type { WorkbookModoGeracao } from '@/types/workbook';

export interface WorkbookRawData {
  receita: Array<{ competencia: string; total_receita: number; total_recebido: number; quantidade: number }>;
  despesa: Array<{ competencia: string; total_despesa: number; total_pago: number; quantidade: number }>;
  faturamento: Array<{ competencia: string; total_faturado: number; quantidade_nfs: number }>;
  fopag: Array<{ competencia: string; funcionario_nome: string; salario_base: number; proventos: number; descontos: number; valor_liquido: number }>;
  caixa: Array<{ conta_descricao: string; banco_nome: string; agencia: string; conta: string; saldo_atual: number }>;
  estoque: Array<{ produto_nome: string; sku: string; grupo_nome: string; quantidade: number; custo_unitario: number; valor_total: number }>;
  agingCR: Array<{ id: string; data_vencimento: string; valor: number; valor_pago: number; saldo_aberto: number; status: string; cliente_id: string; descricao: string }>;
  agingCP: Array<{ id: string; data_vencimento: string; valor: number; valor_pago: number; saldo_aberto: number; status: string; fornecedor_id: string; descricao: string }>;
}

export async function fetchWorkbookData(
  competenciaInicial: string,
  competenciaFinal: string,
  modoGeracao: WorkbookModoGeracao,
): Promise<WorkbookRawData> {
  if (modoGeracao === 'fechado') {
    return fetchClosedModeData(competenciaInicial, competenciaFinal);
  }
  return fetchDynamicModeData(competenciaInicial, competenciaFinal);
}

async function fetchDynamicModeData(compIni: string, compFim: string): Promise<WorkbookRawData> {
  // Normalize competencia range (YYYY-MM)
  const iniYM = compIni.slice(0, 7);
  const fimYM = compFim.slice(0, 7);

  // Use views for aggregated data
  const [receitaRes, despesaRes, fatRes, caixaRes, estoqueRes, agingCRRes, agingCPRes, fopagRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('vw_workbook_receita_mensal').select('*').gte('competencia', iniYM).lte('competencia', fimYM),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('vw_workbook_despesa_mensal').select('*').gte('competencia', iniYM).lte('competencia', fimYM),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('vw_workbook_faturamento_mensal').select('*').gte('competencia', iniYM).lte('competencia', fimYM),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('vw_workbook_bancos_saldo').select('*'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('vw_workbook_estoque_posicao').select('*'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('vw_workbook_aging_cr').select('*'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('vw_workbook_aging_cp').select('*'),
    supabase.from('folha_pagamento')
      .select('competencia, salario_base, proventos, descontos, valor_liquido, funcionarios(nome)')
      .gte('competencia', iniYM)
      .lte('competencia', fimYM),
  ]);

  const receita = (receitaRes.data ?? []).map((r: Record<string, unknown>) => ({
    competencia: r.competencia,
    total_receita: Number(r.total_receita ?? 0),
    total_recebido: Number(r.total_recebido ?? 0),
    quantidade: Number(r.quantidade ?? 0),
  }));

  const despesa = (despesaRes.data ?? []).map((r: Record<string, unknown>) => ({
    competencia: r.competencia,
    total_despesa: Number(r.total_despesa ?? 0),
    total_pago: Number(r.total_pago ?? 0),
    quantidade: Number(r.quantidade ?? 0),
  }));

  const faturamento = (fatRes.data ?? []).map((r: Record<string, unknown>) => ({
    competencia: r.competencia,
    total_faturado: Number(r.total_faturado ?? 0),
    quantidade_nfs: Number(r.quantidade_nfs ?? 0),
  }));

  const fopag = (fopagRes.data ?? []).map((r: Record<string, unknown>) => ({
    competencia: String(r.competencia ?? '').slice(0, 7), // normalize 2026-02-01 -> 2026-02
    funcionario_nome: String((r.funcionarios as Record<string, unknown>)?.nome ?? 'Sem Nome'),
    salario_base: Number(r.salario_base ?? 0),
    proventos: Number(r.proventos ?? 0),
    descontos: Number(r.descontos ?? 0),
    valor_liquido: Number(r.valor_liquido ?? 0),
  }));

  const caixa = (caixaRes.data ?? []).map((r: Record<string, unknown>) => ({
    conta_descricao: String(r.descricao ?? ''),
    banco_nome: String(r.banco_nome ?? ''),
    agencia: String(r.agencia ?? ''),
    conta: String(r.conta ?? ''),
    saldo_atual: Number(r.saldo_atual ?? 0),
  }));

  const estoque = (estoqueRes.data ?? []).map((r: Record<string, unknown>) => ({
    produto_nome: String(r.nome ?? ''),
    sku: String(r.sku ?? ''),
    grupo_nome: String(r.grupo_nome ?? ''),
    quantidade: Number(r.quantidade ?? 0),
    custo_unitario: Number(r.custo_unitario ?? 0),
    valor_total: Number(r.valor_total ?? 0),
  }));

  const agingCR = (agingCRRes.data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id ?? ''),
    data_vencimento: String(r.data_vencimento ?? ''),
    valor: Number(r.valor ?? 0),
    valor_pago: Number(r.valor_pago ?? 0),
    saldo_aberto: Number(r.saldo_aberto ?? 0),
    status: String(r.status ?? ''),
    cliente_id: String(r.cliente_id ?? ''),
    descricao: String(r.descricao ?? ''),
  }));

  const agingCP = (agingCPRes.data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id ?? ''),
    data_vencimento: String(r.data_vencimento ?? ''),
    valor: Number(r.valor ?? 0),
    valor_pago: Number(r.valor_pago ?? 0),
    saldo_aberto: Number(r.saldo_aberto ?? 0),
    status: String(r.status ?? ''),
    fornecedor_id: String(r.fornecedor_id ?? ''),
    descricao: String(r.descricao ?? ''),
  }));

  return { receita, despesa, faturamento, fopag, caixa, estoque, agingCR, agingCP };
}

async function fetchClosedModeData(compIni: string, compFim: string): Promise<WorkbookRawData> {
  const iniYM = compIni.slice(0, 7);
  const fimYM = compFim.slice(0, 7);

  // Validate that fechamentos exist for the period
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fechamentos } = await (supabase as any)
    .from('fechamentos_mensais')
    .select('id, competencia, status')
    .gte('competencia', iniYM)
    .lte('competencia', fimYM)
    .eq('status', 'fechado');

  if (!fechamentos || fechamentos.length === 0) {
    throw new Error(
      `Modo fechado requer fechamentos mensais concluídos para o período ${iniYM} a ${fimYM}. ` +
      `Nenhum fechamento encontrado. Use o modo dinâmico ou realize o fechamento do período.`
    );
  }

  const fechamentoIds = fechamentos.map((f: Record<string, unknown>) => f.id);

  // Fetch from snapshot tables
  const [finRes, caixaRes, estoqueRes, fopagRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('fechamento_financeiro_saldos').select('*').in('fechamento_id', fechamentoIds),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('fechamento_caixa_saldos').select('*, contas_bancarias(descricao, agencia, conta, bancos(nome))').in('fechamento_id', fechamentoIds),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('fechamento_estoque_saldos').select('*, produtos(nome, sku, grupo_id, grupos_produto(nome))').in('fechamento_id', fechamentoIds),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('fechamento_fopag_resumo').select('*, funcionarios(nome)').in('fechamento_id', fechamentoIds),
  ]);

  // Build receita/despesa from snapshot financeiro
  const finData = (finRes.data ?? []) as Record<string, unknown>[];
  const receitaMap: Record<string, { total: number; qty: number }> = {};
  const despesaMap: Record<string, { total: number; qty: number }> = {};

  for (const row of finData) {
    const comp = String(row.competencia ?? '').slice(0, 7);
    if (row.tipo === 'receber') {
      if (!receitaMap[comp]) receitaMap[comp] = { total: 0, qty: 0 };
      receitaMap[comp].total += Number(row.saldo_total ?? 0);
      receitaMap[comp].qty += Number(row.quantidade ?? 0);
    } else {
      if (!despesaMap[comp]) despesaMap[comp] = { total: 0, qty: 0 };
      despesaMap[comp].total += Number(row.saldo_total ?? 0);
      despesaMap[comp].qty += Number(row.quantidade ?? 0);
    }
  }

  const receita = Object.entries(receitaMap).map(([comp, v]) => ({
    competencia: comp, total_receita: v.total, total_recebido: 0, quantidade: v.qty,
  }));
  const despesa = Object.entries(despesaMap).map(([comp, v]) => ({
    competencia: comp, total_despesa: v.total, total_pago: 0, quantidade: v.qty,
  }));

  // Faturamento - not available in snapshot, return empty
  const faturamento: WorkbookRawData['faturamento'] = [];

  const fopag = (fopagRes.data ?? []).map((r: Record<string, unknown>) => ({
    competencia: String(r.competencia ?? '').slice(0, 7),
    funcionario_nome: String((r.funcionarios as Record<string, unknown>)?.nome ?? 'Sem Nome'),
    salario_base: Number(r.salario_base ?? 0),
    proventos: Number(r.proventos ?? 0),
    descontos: Number(r.descontos ?? 0),
    valor_liquido: Number(r.valor_liquido ?? 0),
  }));

  const caixa = (caixaRes.data ?? []).map((r: Record<string, unknown>) => {
    const cb = r.contas_bancarias as Record<string, unknown>;
    return {
      conta_descricao: String(cb?.descricao ?? ''),
      banco_nome: String(cb?.bancos?.nome ?? ''),
      agencia: String(cb?.agencia ?? ''),
      conta: String(cb?.conta ?? ''),
      saldo_atual: Number(r.saldo ?? 0),
    };
  });

  const estoque = (estoqueRes.data ?? []).map((r: Record<string, unknown>) => {
    const p = r.produtos as Record<string, unknown>;
    return {
      produto_nome: String(p?.nome ?? ''),
      sku: String(p?.sku ?? ''),
      grupo_nome: String(p?.grupos_produto?.nome ?? 'Sem Grupo'),
      quantidade: Number(r.quantidade ?? 0),
      custo_unitario: Number(r.valor_custo ?? 0) / Math.max(Number(r.quantidade ?? 1), 1),
      valor_total: Number(r.valor_custo ?? 0),
    };
  });

  // Aging - not snapshotted in closed mode currently, use live data
  const [agingCRRes, agingCPRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('vw_workbook_aging_cr').select('*'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('vw_workbook_aging_cp').select('*'),
  ]);

  const mapAging = (data: Record<string, unknown>[], idField: string) => (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id ?? ''),
    data_vencimento: String(r.data_vencimento ?? ''),
    valor: Number(r.valor ?? 0),
    valor_pago: Number(r.valor_pago ?? 0),
    saldo_aberto: Number(r.saldo_aberto ?? 0),
    status: String(r.status ?? ''),
    [idField]: String(r[idField] ?? ''),
    descricao: String(r.descricao ?? ''),
  }));

  return {
    receita, despesa, faturamento, fopag, caixa, estoque,
    agingCR: mapAging(agingCRRes.data, 'cliente_id') as WorkbookRawData['agingCR'],
    agingCP: mapAging(agingCPRes.data, 'fornecedor_id') as WorkbookRawData['agingCP'],
  };
}
