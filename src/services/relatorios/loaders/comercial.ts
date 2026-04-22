/**
 * Loaders para relatórios comerciais (vendas/faturamento):
 *  - vendas (ordens de venda)
 *  - faturamento (NFs de saída confirmadas)
 *  - vendas_cliente (ranking)
 *  - curva_abc (produtos por faturamento)
 */

import { supabase } from "@/integrations/supabase/client";
import { addParticipacao, computeTop5Concentracao } from "@/utils/relatorios";
import {
  curvaAbcClasseKind,
  faturamentoStatusMap,
  ordemVendaStatusMap,
  resolveStatus,
} from "@/services/relatorios/lib/statusMap";
import {
  withDateRange,
  type FiltroRelatorio,
  type RelatorioResultado,
} from "@/services/relatorios/lib/shared";

export async function loadVendas(filtros: FiltroRelatorio): Promise<RelatorioResultado> {
  let query = supabase
    .from("ordens_venda")
    .select("id, cliente_id, numero, data_emissao, valor_total, status, status_faturamento, clientes(nome_razao_social)")
    .eq("ativo", true)
    .order("data_emissao", { ascending: false });

  query = withDateRange(query, "data_emissao", filtros);
  if (filtros.clienteIds?.length) query = query.in('cliente_id', filtros.clienteIds);
  const { data, error } = await query;
  if (error) throw error;

  const rows = (data || []).map((item: Record<string, unknown>) => {
    const status = (item.status as string | null) ?? '-';
    const fatRaw = ((item as Record<string, unknown>).faturamento_status || item.status_faturamento || '-') as string;
    const stMeta = resolveStatus(ordemVendaStatusMap, status);
    const fatMeta = resolveStatus(faturamentoStatusMap, fatRaw);
    return {
      ordemVendaId: item.id as string,
      clienteId: (item.cliente_id as string | null) ?? undefined,
      numero: item.numero,
      cliente: ((item.clientes as { nome_razao_social?: string } | null)?.nome_razao_social) || "-",
      emissao: item.data_emissao,
      valor: Number(item.valor_total || 0),
      status,
      statusKey: stMeta.key,
      statusKind: stMeta.kind,
      faturamento: fatRaw,
      faturamentoKey: fatMeta.key,
      faturamentoKind: fatMeta.kind,
    };
  });

  const totalVendido = rows.reduce((s, r) => s + r.valor, 0);
  const qtdPedidos = rows.length;
  const ticketMedio = qtdPedidos > 0 ? totalVendido / qtdPedidos : 0;
  const aguardandoFaturamento = rows.filter((r) => r.faturamento === 'aguardando' || r.faturamento === '-').length;

  return {
    title: "Vendas por período",
    subtitle: "Ordens de venda emitidas com status comercial e faturamento.",
    rows,
    chartData: [
      { name: "Aguardando", value: rows.filter((row) => row.faturamento === "aguardando").reduce((sum, row) => sum + row.valor, 0) },
      { name: "Parcial", value: rows.filter((row) => row.faturamento === "parcial").reduce((sum, row) => sum + row.valor, 0) },
      { name: "Total", value: rows.filter((row) => row.faturamento === "total").reduce((sum, row) => sum + row.valor, 0) },
    ],
    kpis: { totalVendido, qtdPedidos, ticketMedio, aguardandoFaturamento },
    meta: {
      kind: 'list',
      valueNature: 'monetario',
      timeAxis: { field: 'emissao', label: 'emissão', required: false },
      drillDownReady: true,
    },
  };
}

export async function loadFaturamento(filtros: FiltroRelatorio): Promise<RelatorioResultado> {
  let query = supabase
    .from("notas_fiscais")
    .select(`
      id, cliente_id, ordem_venda_id, numero, serie, data_emissao, valor_total, modelo_documento,
      frete_valor, icms_valor, ipi_valor, pis_valor, cofins_valor,
      icms_st_valor, desconto_valor, outras_despesas,
      forma_pagamento, status,
      clientes(nome_razao_social),
      ordens_venda(numero)
    `)
    .eq("ativo", true)
    .eq("tipo", "saida")
    .eq("status", "confirmada")
    .order("data_emissao", { ascending: false });

  query = withDateRange(query, "data_emissao", filtros);
  if (filtros.clienteIds) query = query.in('cliente_id', filtros.clienteIds);
  const { data, error } = await query;
  if (error) throw error;

  const modeloLabels: Record<string, string> = { '55': 'NF-e', '65': 'NFC-e', '57': 'CT-e', 'nfse': 'NFS-e' };

  const rows = (data || []).map((nf) => {
    const totalImpostos = Number(nf.icms_valor || 0) + Number(nf.ipi_valor || 0) +
      Number(nf.pis_valor || 0) + Number(nf.cofins_valor || 0) + Number(nf.icms_st_valor || 0);
    const valorTotal = Number(nf.valor_total || 0);
    const cliente = nf.clientes as { nome_razao_social: string } | null;
    const ov = nf.ordens_venda as { numero: string } | null;

    return {
      notaFiscalId: (nf as Record<string, unknown>).id as string,
      clienteId: ((nf as Record<string, unknown>).cliente_id as string | null) ?? undefined,
      ordemVendaId: ((nf as Record<string, unknown>).ordem_venda_id as string | null) ?? undefined,
      data: nf.data_emissao,
      nf: `${nf.numero}/${nf.serie || '1'}`,
      modelo: modeloLabels[nf.modelo_documento || '55'] || nf.modelo_documento || 'NF-e',
      cliente: cliente?.nome_razao_social || '—',
      ov: ov?.numero || '—',
      frete: Number(nf.frete_valor || 0),
      desconto: Number(nf.desconto_valor || 0),
      impostos: totalImpostos,
      valorTotal,
      receitaLiquida: valorTotal - totalImpostos,
    };
  });

  const totalBruto = rows.reduce((s, r) => s + r.valorTotal, 0);
  const totalImpostos = rows.reduce((s, r) => s + r.impostos, 0);
  const totalLiquido = rows.reduce((s, r) => s + r.receitaLiquida, 0);

  const byMonth = new Map<string, number>();
  rows.forEach(r => {
    const m = r.data.slice(0, 7);
    byMonth.set(m, (byMonth.get(m) || 0) + r.valorTotal);
  });

  return {
    title: "Faturamento",
    subtitle: "Notas fiscais de saída confirmadas — valor bruto, impostos e receita líquida.",
    rows,
    chartData: Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => ({
        name: new Date(month + '-01T12:00:00').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        value,
      })),
    totals: { totalBruto, totalImpostos, totalLiquido },
    kpis: { totalNotas: rows.length, totalBruto, totalImpostos, totalLiquido },
    meta: {
      kind: 'list',
      valueNature: 'monetario',
      timeAxis: { field: 'emissao', label: 'emissão', required: false },
      drillDownReady: true,
    },
  };
}

export async function loadVendasCliente(filtros: FiltroRelatorio): Promise<RelatorioResultado> {
  let query = supabase
    .from("ordens_venda")
    .select("cliente_id, valor_total, clientes(nome_razao_social, cpf_cnpj)")
    .eq("ativo", true);
  query = withDateRange(query, "data_emissao", filtros);
  if (filtros.clienteIds?.length) query = query.in('cliente_id', filtros.clienteIds);
  const { data, error } = await query;
  if (error) throw error;

  const map = new Map<string, { clienteId: string | null; cliente: string; cnpj: string; total: number; qtd: number }>();
  for (const ov of data || []) {
    const c = ov.clientes as { nome_razao_social: string; cpf_cnpj: string | null } | null;
    const nome = c?.nome_razao_social || "Sem cliente";
    const key = ((ov as Record<string, unknown>).cliente_id as string | null) || nome;
    const existing = map.get(key) || { clienteId: ((ov as Record<string, unknown>).cliente_id as string | null), cliente: nome, cnpj: c?.cpf_cnpj || "-", total: 0, qtd: 0 };
    existing.total += Number(ov.valor_total || 0);
    existing.qtd += 1;
    map.set(key, existing);
  }

  const rows = Array.from(map.values()).sort((a, b) => b.total - a.total).map((r, i) => ({
    posicao: i + 1, clienteId: r.clienteId ?? undefined, cliente: r.cliente, cnpj: r.cnpj, pedidos: r.qtd, valorTotal: r.total,
    ticketMedio: r.qtd > 0 ? r.total / r.qtd : 0,
  }));

  const grandTotalVcli = rows.reduce((r, s) => r + s.valorTotal, 0);
  const rowsWithParticipacao = addParticipacao(rows, grandTotalVcli);

  const clientesAtendidos = rowsWithParticipacao.length;
  const totalPedidos = rowsWithParticipacao.reduce((s, r) => s + r.pedidos, 0);
  const ticketMedioGeral = totalPedidos > 0 ? grandTotalVcli / totalPedidos : 0;
  const top5Concentracao = computeTop5Concentracao(rowsWithParticipacao, grandTotalVcli);

  return {
    title: "Vendas por Cliente",
    subtitle: "Ranking de clientes por volume de vendas.",
    rows: rowsWithParticipacao,
    chartData: rowsWithParticipacao.slice(0, 8).map(r => ({ name: r.cliente.substring(0, 20), value: r.valorTotal })),
    kpis: { totalVendido: grandTotalVcli, clientesAtendidos, ticketMedioGeral, top5Concentracao },
    meta: {
      kind: 'ranking',
      valueNature: 'monetario',
      timeAxis: { field: 'emissao', label: 'emissão', required: false },
      drillDownReady: true,
    },
  };
}

export async function loadCurvaAbc(filtros: FiltroRelatorio): Promise<RelatorioResultado> {
  let nfQuery = supabase
    .from("notas_fiscais_itens")
    .select(`
      produto_id,
      quantidade,
      valor_unitario,
      produtos(nome, codigo_interno),
      notas_fiscais!inner(ativo, tipo, status, data_emissao)
    `)
    .eq("notas_fiscais.ativo", true)
    .eq("notas_fiscais.tipo", "saida")
    .eq("notas_fiscais.status", "confirmada");

  nfQuery = withDateRange(nfQuery, "notas_fiscais.data_emissao", filtros);
  if (filtros.clienteIds?.length) nfQuery = nfQuery.in('notas_fiscais.cliente_id', filtros.clienteIds);

  const { data, error } = await nfQuery;
  if (error) throw error;

  const prodMap = new Map<string, { produto: string; codigo: string; total: number }>();
  for (const item of data || []) {
    const key = item.produto_id || "sem-produto";
    const prod = item.produtos as { nome?: string; codigo_interno?: string } | null;
    const nome = prod?.nome || "Produto removido";
    const codigo = prod?.codigo_interno || "-";
    const existing = prodMap.get(key) || { produto: nome, codigo, total: 0 };
    const itemTotal = Number(item.quantidade || 0) * Number(item.valor_unitario || 0);
    existing.total += itemTotal;
    prodMap.set(key, existing);
  }

  const sorted = Array.from(prodMap.values()).sort((a, b) => b.total - a.total);
  const grandTotal = sorted.reduce((s, r) => s + r.total, 0);

  let acumulado = 0;
  const rows = sorted.map((item, i) => {
    acumulado += item.total;
    const pctAcum = grandTotal > 0 ? (acumulado / grandTotal) * 100 : 0;
    const classe: 'A' | 'B' | 'C' = pctAcum <= 80 ? 'A' : pctAcum <= 95 ? 'B' : 'C';
    return {
      posicao: i + 1,
      codigo: item.codigo,
      produto: item.produto,
      faturamento: item.total,
      percentual: grandTotal > 0 ? ((item.total / grandTotal) * 100) : 0,
      acumulado: pctAcum,
      classe,
      classeKind: curvaAbcClasseKind(classe),
      statusKey: `classe_${classe.toLowerCase()}`,
      statusKind: curvaAbcClasseKind(classe),
    };
  });

  const classA = rows.filter(r => r.classe === 'A');
  const classB = rows.filter(r => r.classe === 'B');
  const classC = rows.filter(r => r.classe === 'C');

  return {
    title: "Curva ABC de Produtos",
    subtitle: "Classificação por faturamento real — notas fiscais de saída confirmadas.",
    rows,
    chartData: [
      { name: `A (${classA.length} itens)`, value: classA.reduce((s, r) => s + r.faturamento, 0) },
      { name: `B (${classB.length} itens)`, value: classB.reduce((s, r) => s + r.faturamento, 0) },
      { name: `C (${classC.length} itens)`, value: classC.reduce((s, r) => s + r.faturamento, 0) },
    ],
    totals: { grandTotal },
    kpis: { grandTotal, itensClasseA: classA.length, itensClasseB: classB.length, itensClasseC: classC.length },
    meta: {
      kind: 'list',
      valueNature: 'monetario',
      timeAxis: { field: 'emissao', label: 'emissão', required: false },
      drillDownReady: false,
    },
  };
}