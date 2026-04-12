/**
 * Fetches all data needed for presentation generation.
 * Uses vw_apresentacao_* views (which reuse workbook analytics layer).
 * Supports both dynamic and closed modes.
 * V2 adds 8 additional datasets.
 */
import { supabase } from '@/integrations/supabase/client';
import type {
  ApresentacaoModoGeracao,
  ApresentacaoRawData,
  HighlightFinanceiro,
  FaturamentoMensal,
  DespesaCategoria,
  RolCaixa,
  ReceitaVsDespesa,
  FopagResumo,
  FluxoCaixa,
  LucroItem,
  EstoqueItem,
  VendaEstado,
  RedesSociais,
  AgingItem,
  TopClienteItem,
  TopFornecedorItem,
  InadimplenciaItem,
  BackorderItem,
  DreLinhaItem,
  ResultadoFinanceiroItem,
  TributoItem,
} from '@/types/apresentacao';

export async function fetchPresentationData(
  competenciaInicial: string,
  competenciaFinal: string,
  modoGeracao: ApresentacaoModoGeracao
): Promise<ApresentacaoRawData> {
  if (modoGeracao === 'fechado') {
    return fetchClosedModeData(competenciaInicial, competenciaFinal);
  }
  return fetchDynamicModeData(competenciaInicial, competenciaFinal);
}

// -------------------------------------------------------
// Dynamic mode — queries live vw_apresentacao_* views
// -------------------------------------------------------
async function fetchDynamicModeData(
  compIni: string,
  compFim: string
): Promise<ApresentacaoRawData> {
  const iniYM = compIni.slice(0, 7);
  const fimYM = compFim.slice(0, 7);

  const [
    hlRes,
    fatRes,
    despRes,
    caixaRes,
    recVsDesp,
    fopagRes,
    fluxoRes,
    lucroRes,
    estoqueRes,
    estadoRes,
    socialRes,
    agingRes,
    topCliRes,
    topForRes,
    inadimRes,
    backorderRes,
    dreRes,
    resultFinRes,
    tributosRes,
  ] = await Promise.all([
    (supabase as any)
      .from('vw_apresentacao_highlights_financeiros')
      .select('*')
      .gte('competencia', iniYM)
      .lte('competencia', fimYM),
    (supabase as any)
      .from('vw_apresentacao_faturamento')
      .select('*')
      .gte('competencia', iniYM)
      .lte('competencia', fimYM),
    (supabase as any)
      .from('vw_apresentacao_despesas')
      .select('*')
      .gte('competencia', iniYM)
      .lte('competencia', fimYM),
    (supabase as any).from('vw_apresentacao_rol_caixa').select('*'),
    (supabase as any)
      .from('vw_apresentacao_receita_vs_despesa')
      .select('*')
      .gte('competencia', iniYM)
      .lte('competencia', fimYM),
    (supabase as any)
      .from('vw_apresentacao_fopag')
      .select('*')
      .gte('competencia', iniYM)
      .lte('competencia', fimYM),
    (supabase as any)
      .from('vw_apresentacao_fluxo_caixa')
      .select('*')
      .gte('competencia', iniYM)
      .lte('competencia', fimYM),
    (supabase as any)
      .from('vw_apresentacao_lucro_produto_cliente')
      .select('*')
      .gte('competencia', iniYM)
      .lte('competencia', fimYM),
    (supabase as any).from('vw_apresentacao_variacao_estoque').select('*'),
    (supabase as any)
      .from('vw_apresentacao_venda_estado')
      .select('*')
      .gte('competencia', iniYM)
      .lte('competencia', fimYM),
    (supabase as any)
      .from('vw_apresentacao_redes_sociais')
      .select('*')
      .gte('competencia', iniYM)
      .lte('competencia', fimYM),
    // V2 datasets
    (supabase as any).from('vw_apresentacao_aging_consolidado').select('*'),
    (supabase as any)
      .from('vw_apresentacao_top_clientes')
      .select('*')
      .gte('competencia', iniYM)
      .lte('competencia', fimYM),
    (supabase as any)
      .from('vw_apresentacao_top_fornecedores')
      .select('*')
      .gte('competencia', iniYM)
      .lte('competencia', fimYM),
    (supabase as any)
      .from('vw_apresentacao_inadimplencia')
      .select('*')
      .gte('competencia_vencimento', iniYM)
      .lte('competencia_vencimento', fimYM),
    (supabase as any)
      .from('vw_apresentacao_backorder')
      .select('*')
      .gte('competencia', iniYM)
      .lte('competencia', fimYM),
    (supabase as any)
      .from('vw_apresentacao_dre_gerencial')
      .select('*')
      .gte('competencia', iniYM)
      .lte('competencia', fimYM),
    (supabase as any)
      .from('vw_apresentacao_resultado_financeiro')
      .select('*')
      .gte('competencia', iniYM)
      .lte('competencia', fimYM),
    (supabase as any)
      .from('vw_apresentacao_tributos')
      .select('*')
      .gte('competencia', iniYM)
      .lte('competencia', fimYM),
  ]);

  return {
    highlights: normalizeHighlights(hlRes.data),
    faturamento: normalizeFaturamento(fatRes.data),
    despesas: normalizeDespesas(despRes.data),
    rolCaixa: normalizeRolCaixa(caixaRes.data),
    receitaVsDespesa: normalizeReceitaVsDespesa(recVsDesp.data),
    fopag: normalizeFopag(fopagRes.data),
    fluxoCaixa: normalizeFluxoCaixa(fluxoRes.data),
    lucro: normalizeLucro(lucroRes.data),
    estoque: normalizeEstoque(estoqueRes.data),
    vendaEstado: normalizeVendaEstado(estadoRes.data),
    redesSociais: normalizeRedesSociais(socialRes.data),
    // V2
    aging: normalizeAging(agingRes.data),
    topClientes: normalizeTopClientes(topCliRes.data),
    topFornecedores: normalizeTopFornecedores(topForRes.data),
    inadimplencia: normalizeInadimplencia(inadimRes.data),
    backorder: normalizeBackorder(backorderRes.data),
    dreGerencial: normalizeDreGerencial(dreRes.data),
    resultadoFinanceiro: normalizeResultadoFinanceiro(resultFinRes.data),
    tributos: normalizeTributos(tributosRes.data),
  };
}

// -------------------------------------------------------
// Closed mode — uses fechamento snapshots
// -------------------------------------------------------
async function fetchClosedModeData(
  compIni: string,
  competenciaFinal: string
): Promise<ApresentacaoRawData> {
  // Validate that closed snapshots exist for the requested period
  const { data: fechamentos, error: fechError } = await (supabase as any)
    .from('fechamentos_mensais')
    .select('*')
    .gte('competencia', compIni.slice(0, 7))
    .lte('competencia', competenciaFinal.slice(0, 7))
    .eq('status', 'fechado');

  if (fechError) throw fechError;
  if (!fechamentos || fechamentos.length === 0) {
    throw new Error(
      'Modo fechado: não existem fechamentos consolidados para o período selecionado. ' +
        'Verifique os fechamentos mensais ou utilize o modo dinâmico.'
    );
  }

  const fechamentoIds = fechamentos.map((f: { id: string }) => f.id);

  // Load snapshots from fechamento tables
  const [finRes, caixaRes, estoqueRes, fopagRes] = await Promise.all([
    (supabase as any)
      .from('fechamento_financeiro_saldos')
      .select('*')
      .in('fechamento_id', fechamentoIds),
    (supabase as any)
      .from('fechamento_caixa_saldos')
      .select('*, contas_bancarias(descricao, banco_nome, agencia, conta)')
      .in('fechamento_id', fechamentoIds),
    (supabase as any)
      .from('fechamento_estoque_saldos')
      .select('*, produtos(nome, sku, custo_medio, grupos_produto(nome))')
      .in('fechamento_id', fechamentoIds),
    (supabase as any)
      .from('fechamento_fopag_resumo')
      .select('*, funcionarios(nome)')
      .in('fechamento_id', fechamentoIds),
  ]);

  // Map fechamento_id → competencia
  const idToComp: Record<string, string> = {};
  fechamentos.forEach((f: { id: string; competencia: string }) => {
    idToComp[f.id] = f.competencia;
  });

  const finData: Array<{ fechamento_id: string; tipo: string; saldo_total?: number; competencia?: string }> =
    finRes.data ?? [];
  const highlights: HighlightFinanceiro[] = fechamentos.map(
    (f: { id: string; competencia: string }) => {
      const rec = finData.filter((r) => r.fechamento_id === f.id && r.tipo === 'receber');
      const pag = finData.filter((r) => r.fechamento_id === f.id && r.tipo === 'pagar');
      const totalReceita = rec.reduce((s: number, r) => s + Number(r.saldo_total ?? 0), 0);
      const totalDespesa = pag.reduce((s: number, r) => s + Number(r.saldo_total ?? 0), 0);
      return {
        competencia: f.competencia,
        total_receita: totalReceita,
        total_recebido: totalReceita,
        total_despesa: totalDespesa,
        total_pago: totalDespesa,
        resultado_bruto: totalReceita - totalDespesa,
      };
    }
  );

  const caixaData: Array<{ conta_bancaria_id: string; saldo?: number; contas_bancarias?: { descricao: string; banco_nome: string; agencia: string; conta: string } }> =
    caixaRes.data ?? [];
  const rolCaixa: RolCaixa[] = caixaData.map((c) => ({
    conta_bancaria_id: c.conta_bancaria_id,
    conta_descricao: c.contas_bancarias?.descricao ?? '',
    banco_nome: c.contas_bancarias?.banco_nome ?? '',
    agencia: c.contas_bancarias?.agencia ?? '',
    conta: c.contas_bancarias?.conta ?? '',
    saldo_atual: Number(c.saldo ?? 0),
  }));

  const estoqueData: Array<{ produto_id?: string; quantidade?: number; valor_custo?: number; produtos?: { nome: string; sku: string; custo_medio?: number; grupos_produto?: { nome: string } } }> =
    estoqueRes.data ?? [];
  const estoque: EstoqueItem[] = estoqueData.map((e) => ({
    produto_id: e.produto_id ?? '',
    produto_nome: e.produtos?.nome ?? '',
    produto_sku: e.produtos?.sku ?? '',
    grupo_nome: e.produtos?.grupos_produto?.nome ?? 'Sem Grupo',
    quantidade_atual: Number(e.quantidade ?? 0),
    custo_unitario: Number(e.produtos?.custo_medio ?? 0),
    valor_total: Number(e.quantidade ?? 0) * Number(e.produtos?.custo_medio ?? 0),
  }));

  const fopagData: Array<{ fechamento_id: string; competencia: string; salario_base?: number; proventos?: number; descontos?: number; valor_liquido?: number; funcionarios?: { nome: string } }> =
    fopagRes.data ?? [];
  const fopag: FopagResumo[] = fopagData.map((fp) => ({
    competencia: idToComp[fp.fechamento_id] ?? fp.competencia,
    funcionario_nome: fp.funcionarios?.nome ?? 'Sem Nome',
    salario_base: Number(fp.salario_base ?? 0),
    proventos: Number(fp.proventos ?? 0),
    descontos: Number(fp.descontos ?? 0),
    valor_liquido: Number(fp.valor_liquido ?? 0),
  }));

  return {
    highlights,
    faturamento: [],
    despesas: [],
    rolCaixa,
    receitaVsDespesa: highlights.map((h, i) => ({
      ...h,
      receita_mes_anterior: i > 0 ? highlights[i - 1].total_receita : null,
      despesa_mes_anterior: i > 0 ? highlights[i - 1].total_despesa : null,
    })),
    fopag,
    fluxoCaixa: [],
    lucro: [],
    estoque,
    vendaEstado: [],
    redesSociais: [],
    // V2 — closed-mode snapshots do not include these yet; return empty
    aging: [],
    topClientes: [],
    topFornecedores: [],
    inadimplencia: [],
    backorder: [],
    dreGerencial: [],
    resultadoFinanceiro: [],
    tributos: [],
  };
}

// -------------------------------------------------------
// Normalizers
// -------------------------------------------------------

function normalizeHighlights(raw: unknown[]): HighlightFinanceiro[] {
  return (raw ?? []).map((r: any) => ({
    competencia: String(r.competencia ?? ''),
    total_receita: Number(r.total_receita ?? 0),
    total_recebido: Number(r.total_recebido ?? 0),
    total_despesa: Number(r.total_despesa ?? 0),
    total_pago: Number(r.total_pago ?? 0),
    resultado_bruto: Number(r.resultado_bruto ?? 0),
  }));
}

function normalizeFaturamento(raw: unknown[]): FaturamentoMensal[] {
  return (raw ?? []).map((r: any) => ({
    competencia: String(r.competencia ?? ''),
    quantidade_nfs: Number(r.quantidade_nfs ?? 0),
    total_faturado: Number(r.total_faturado ?? 0),
    total_produtos: Number(r.total_produtos ?? 0),
    total_desconto: Number(r.total_desconto ?? 0),
  }));
}

function normalizeDespesas(raw: unknown[]): DespesaCategoria[] {
  return (raw ?? []).map((r: any) => ({
    competencia: String(r.competencia ?? ''),
    categoria: String(r.categoria ?? 'Sem Classificação'),
    total_despesa: Number(r.total_despesa ?? 0),
    total_pago: Number(r.total_pago ?? 0),
    quantidade: Number(r.quantidade ?? 0),
  }));
}

function normalizeRolCaixa(raw: unknown[]): RolCaixa[] {
  return (raw ?? []).map((r: any) => ({
    conta_bancaria_id: String(r.conta_bancaria_id ?? ''),
    conta_descricao: String(r.conta_descricao ?? ''),
    banco_nome: String(r.banco_nome ?? ''),
    agencia: String(r.agencia ?? ''),
    conta: String(r.conta ?? ''),
    saldo_atual: Number(r.saldo_atual ?? 0),
  }));
}

function normalizeReceitaVsDespesa(raw: unknown[]): ReceitaVsDespesa[] {
  return (raw ?? []).map((r: any) => ({
    competencia: String(r.competencia ?? ''),
    total_receita: Number(r.total_receita ?? 0),
    total_recebido: Number(r.total_recebido ?? 0),
    total_despesa: Number(r.total_despesa ?? 0),
    total_pago: Number(r.total_pago ?? 0),
    resultado_bruto: Number(r.resultado_bruto ?? 0),
    receita_mes_anterior: r.receita_mes_anterior != null ? Number(r.receita_mes_anterior) : null,
    despesa_mes_anterior: r.despesa_mes_anterior != null ? Number(r.despesa_mes_anterior) : null,
  }));
}

function normalizeFopag(raw: unknown[]): FopagResumo[] {
  return (raw ?? []).map((r: any) => ({
    competencia: String(r.competencia ?? '').slice(0, 7),
    funcionario_nome: String(r.funcionario_nome ?? 'Sem Nome'),
    salario_base: Number(r.salario_base ?? 0),
    proventos: Number(r.proventos ?? 0),
    descontos: Number(r.descontos ?? 0),
    valor_liquido: Number(r.valor_liquido ?? 0),
  }));
}

function normalizeFluxoCaixa(raw: unknown[]): FluxoCaixa[] {
  return (raw ?? []).map((r: any) => ({
    competencia: String(r.competencia ?? ''),
    total_entradas: Number(r.total_entradas ?? 0),
    total_saidas: Number(r.total_saidas ?? 0),
    saldo_periodo: Number(r.saldo_periodo ?? 0),
  }));
}

function normalizeLucro(raw: unknown[]): LucroItem[] {
  return (raw ?? []).map((r: any) => ({
    competencia: String(r.competencia ?? ''),
    produto_id: String(r.produto_id ?? ''),
    produto_nome: String(r.produto_nome ?? ''),
    produto_sku: String(r.produto_sku ?? ''),
    cliente_id: String(r.cliente_id ?? ''),
    cliente_nome: String(r.cliente_nome ?? ''),
    quantidade_vendida: Number(r.quantidade_vendida ?? 0),
    receita_bruta: Number(r.receita_bruta ?? 0),
    custo_total: Number(r.custo_total ?? 0),
    margem_bruta: Number(r.margem_bruta ?? 0),
  }));
}

function normalizeEstoque(raw: unknown[]): EstoqueItem[] {
  return (raw ?? []).map((r: any) => ({
    produto_id: String(r.produto_id ?? ''),
    produto_nome: String(r.produto_nome ?? ''),
    produto_sku: String(r.produto_sku ?? ''),
    grupo_nome: String(r.grupo_nome ?? 'Sem Grupo'),
    quantidade_atual: Number(r.quantidade_atual ?? 0),
    custo_unitario: Number(r.custo_unitario ?? 0),
    valor_total: Number(r.valor_total ?? 0),
  }));
}

function normalizeVendaEstado(raw: unknown[]): VendaEstado[] {
  return (raw ?? []).map((r: any) => ({
    competencia: String(r.competencia ?? ''),
    estado: String(r.estado ?? 'N/D'),
    quantidade_pedidos: Number(r.quantidade_pedidos ?? 0),
    total_vendas: Number(r.total_vendas ?? 0),
    clientes_ativos: Number(r.clientes_ativos ?? 0),
  }));
}

function normalizeRedesSociais(raw: unknown[]): RedesSociais[] {
  return (raw ?? []).map((r: any) => ({
    competencia: String(r.competencia ?? ''),
    plataforma: String(r.plataforma ?? ''),
    metrica: String(r.metrica ?? ''),
    valor: Number(r.valor ?? 0),
  }));
}

// -------------------------------------------------------
// V2 normalizers
// -------------------------------------------------------

function normalizeAging(raw: unknown[]): AgingItem[] {
  return (raw ?? []).map((r: any) => ({
    tipo: String(r.tipo ?? ''),
    data_vencimento: String(r.data_vencimento ?? ''),
    faixa_aging: String(r.faixa_aging ?? ''),
    status: String(r.status ?? ''),
    saldo_aberto: Number(r.saldo_aberto ?? 0),
    quantidade: Number(r.quantidade ?? 0),
  }));
}

function normalizeTopClientes(raw: unknown[]): TopClienteItem[] {
  return (raw ?? []).map((r: any) => ({
    competencia: String(r.competencia ?? ''),
    cliente_id: String(r.cliente_id ?? ''),
    cliente_nome: String(r.cliente_nome ?? ''),
    estado: String(r.estado ?? 'N/D'),
    total_pedidos: Number(r.total_pedidos ?? 0),
    total_vendas: Number(r.total_vendas ?? 0),
    ticket_medio: Number(r.ticket_medio ?? 0),
  }));
}

function normalizeTopFornecedores(raw: unknown[]): TopFornecedorItem[] {
  return (raw ?? []).map((r: any) => ({
    competencia: String(r.competencia ?? ''),
    fornecedor_id: String(r.fornecedor_id ?? ''),
    fornecedor_nome: String(r.fornecedor_nome ?? ''),
    total_compras: Number(r.total_compras ?? 0),
    total_pago: Number(r.total_pago ?? 0),
    quantidade_titulos: Number(r.quantidade_titulos ?? 0),
  }));
}

function normalizeInadimplencia(raw: unknown[]): InadimplenciaItem[] {
  return (raw ?? []).map((r: any) => ({
    competencia_vencimento: String(r.competencia_vencimento ?? ''),
    faixa_atraso: String(r.faixa_atraso ?? ''),
    quantidade_titulos: Number(r.quantidade_titulos ?? 0),
    saldo_inadimplente: Number(r.saldo_inadimplente ?? 0),
    clientes_inadimplentes: Number(r.clientes_inadimplentes ?? 0),
  }));
}

function normalizeBackorder(raw: unknown[]): BackorderItem[] {
  return (raw ?? []).map((r: any) => ({
    competencia: String(r.competencia ?? ''),
    pedido_id: String(r.pedido_id ?? ''),
    cliente_nome: String(r.cliente_nome ?? ''),
    status: String(r.status ?? ''),
    valor_total: Number(r.valor_total ?? 0),
    data_pedido: String(r.data_pedido ?? ''),
    dias_em_aberto: Number(r.dias_em_aberto ?? 0),
  }));
}

function normalizeDreGerencial(raw: unknown[]): DreLinhaItem[] {
  return (raw ?? []).map((r: any) => ({
    competencia: String(r.competencia ?? ''),
    linha_dre: String(r.linha_dre ?? 'Sem Classificação'),
    linha_gerencial: String(r.linha_gerencial ?? 'Sem Classificação'),
    sinal_padrao: Number(r.sinal_padrao ?? 1),
    valor_total: Number(r.valor_total ?? 0),
  }));
}

function normalizeResultadoFinanceiro(raw: unknown[]): ResultadoFinanceiroItem[] {
  return (raw ?? []).map((r: any) => ({
    competencia: String(r.competencia ?? ''),
    grupo: String(r.grupo ?? 'Sem Classificação'),
    tipo: String(r.tipo ?? ''),
    valor_total: Number(r.valor_total ?? 0),
    valor_realizado: Number(r.valor_realizado ?? 0),
  }));
}

function normalizeTributos(raw: unknown[]): TributoItem[] {
  return (raw ?? []).map((r: any) => ({
    competencia: String(r.competencia ?? ''),
    grupo_tributo: String(r.grupo_tributo ?? 'Outros'),
    valor_total: Number(r.valor_total ?? 0),
    valor_pago: Number(r.valor_pago ?? 0),
  }));
}
