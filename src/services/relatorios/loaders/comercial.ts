/**
 * Loaders para relatórios comerciais (vendas/faturamento):
 *  - vendas (pedidos registrados nos orçamentos)
 *  - faturamento (NFs de saída confirmadas)
 *  - vendas_cliente (ranking)
 *  - curva_abc (produtos por faturamento)
 */

import { supabase } from "@/integrations/supabase/client";
import { addParticipacao, computeTop5Concentracao } from "@/utils/relatorios";
import {
  curvaAbcClasseKind,
  FATURAMENTO_PEDIDO_LABEL,
  pedidoFaturamentoStatusMap,
  resolveStatus,
} from "@/services/relatorios/lib/statusMap";
import { CANAL_LABEL, type CanalVenda } from "@/services/comercial/pedidoDireto.service";
import {
  withDateRange,
  type FiltroRelatorio,
  type RelatorioResultado,
} from "@/services/relatorios/lib/shared";
import { fetchAllPages } from "@/services/relatorios/lib/fetchAllPages";

/**
 * Pedidos de venda = orçamentos com pedido registrado (`aprovado`, ou
 * `convertido` legado) e orçamentos do histórico que já têm NF vinculada.
 * O período filtra pela data do orçamento.
 */
export const PEDIDOS_FILTRO_OR =
  "status.in.(aprovado,convertido),and(status.eq.historico,faturamento_status.not.is.null)";

export async function loadVendas(filtros: FiltroRelatorio): Promise<RelatorioResultado> {
  const data = await fetchAllPages<Record<string, unknown>>(() => {
    let q = supabase
      .from("orcamentos")
      .select("id, cliente_id, numero, pedido_cliente, data_pedido_cliente, data_orcamento, valor_total, status, faturamento_status, canal, clientes(nome_razao_social)")
      .eq("ativo", true)
      .or(PEDIDOS_FILTRO_OR)
      .order("data_orcamento", { ascending: false });
    q = withDateRange(q, "data_orcamento", filtros);
    if (filtros.clienteIds?.length) q = q.in('cliente_id', filtros.clienteIds);
    if (filtros.tipos?.length) q = q.in('canal', filtros.tipos);
    return q;
  });

  const rows = data.map((item: Record<string, unknown>) => {
    const fatRaw = (item.faturamento_status as string | null) || 'aberto';
    const fatMeta = resolveStatus(pedidoFaturamentoStatusMap, fatRaw);
    return {
      orcamentoId: item.id as string,
      clienteId: (item.cliente_id as string | null) ?? undefined,
      numero: (item.pedido_cliente as string | null) || (item.numero as string),
      orcamento: item.numero,
      canal: CANAL_LABEL[((item.canal as string | null) ?? "orcamento") as CanalVenda] ?? (item.canal as string),
      cliente: ((item.clientes as { nome_razao_social?: string } | null)?.nome_razao_social) || "-",
      emissao: (item.data_pedido_cliente as string | null) ?? item.data_orcamento,
      valor: Number(item.valor_total || 0),
      faturamento: FATURAMENTO_PEDIDO_LABEL[fatRaw] ?? fatRaw,
      faturamentoKey: fatMeta.key,
      faturamentoKind: fatMeta.kind,
      status: FATURAMENTO_PEDIDO_LABEL[fatRaw] ?? fatRaw,
      statusKey: fatMeta.key,
      statusKind: fatMeta.kind,
    };
  });

  const totalVendido = rows.reduce((s, r) => s + r.valor, 0);
  const qtdPedidos = rows.length;
  const ticketMedio = qtdPedidos > 0 ? totalVendido / qtdPedidos : 0;
  const aguardandoFaturamento = rows.filter((r) => r.statusKey === 'aberto' || r.statusKey === 'parcial').length;
  const somaPor = (key: string) => rows.filter((r) => r.statusKey === key).reduce((sum, r) => sum + r.valor, 0);

  return {
    title: "Vendas por período",
    subtitle: "Pedidos registrados nos orçamentos, com a situação de faturamento.",
    rows,
    chartData: [
      { name: "A faturar", value: somaPor("aberto") },
      { name: "Parcial", value: somaPor("parcial") },
      { name: "Faturado", value: somaPor("faturado") },
      { name: "Encerrado", value: somaPor("encerrado") },
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
  const data = await fetchAllPages<Record<string, unknown>>(() => {
    let q = supabase
      .from("notas_fiscais")
      .select(`
        id, cliente_id, numero, serie, data_emissao, valor_total, modelo_documento,
        frete_valor, icms_valor, ipi_valor, pis_valor, cofins_valor,
        icms_st_valor, desconto_valor, outras_despesas,
        forma_pagamento, status,
        clientes(nome_razao_social),
        orcamento_nf_vinculos(orcamento_id, orcamentos(numero, pedido_cliente))
      `)
      .eq("ativo", true)
      .eq("tipo", "saida")
      .eq("status", "confirmada")
      .order("data_emissao", { ascending: false });
    q = withDateRange(q, "data_emissao", filtros);
    if (filtros.clienteIds) q = q.in('cliente_id', filtros.clienteIds);
    return q;
  });

  const modeloLabels: Record<string, string> = { '55': 'NF-e', '65': 'NFC-e', '57': 'CT-e', 'nfse': 'NFS-e' };

  const rows = data.map((nf: Record<string, unknown>) => {
    const totalImpostos = Number(nf.icms_valor || 0) + Number(nf.ipi_valor || 0) +
      Number(nf.pis_valor || 0) + Number(nf.cofins_valor || 0) + Number(nf.icms_st_valor || 0);
    const valorTotal = Number(nf.valor_total || 0);
    const cliente = nf.clientes as { nome_razao_social: string } | null;
    const vinculos = (nf.orcamento_nf_vinculos ?? []) as Array<{
      orcamento_id: string;
      orcamentos: { numero: string; pedido_cliente: string | null } | null;
    }>;
    const pedidos = vinculos
      .map((v) => v.orcamentos?.pedido_cliente || v.orcamentos?.numero)
      .filter((p): p is string => !!p);

    return {
      notaFiscalId: nf.id as string,
      clienteId: (nf.cliente_id as string | null) ?? undefined,
      orcamentoId: vinculos[0]?.orcamento_id,
      data: nf.data_emissao as string | null,
      nf: `${nf.numero}/${nf.serie || '1'}`,
      modelo: modeloLabels[(nf.modelo_documento as string) || '55'] || (nf.modelo_documento as string) || 'NF-e',
      cliente: cliente?.nome_razao_social || '—',
      pedido: pedidos.length ? [...new Set(pedidos)].join(', ') : '—',
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
    const m = (r.data ?? "").slice(0, 7);
    if (!m) return;
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
  const data = await fetchAllPages<Record<string, unknown>>(() => {
    let q = supabase
      .from("orcamentos")
      .select("cliente_id, valor_total, clientes(nome_razao_social, cpf_cnpj)")
      .eq("ativo", true)
      .or(PEDIDOS_FILTRO_OR)
      .order("data_orcamento", { ascending: false });
    q = withDateRange(q, "data_orcamento", filtros);
    if (filtros.clienteIds?.length) q = q.in('cliente_id', filtros.clienteIds);
    if (filtros.tipos?.length) q = q.in('canal', filtros.tipos);
    return q;
  });

  const map = new Map<string, { clienteId: string | null; cliente: string; cnpj: string; total: number; qtd: number }>();
  for (const ped of data as Record<string, unknown>[]) {
    const c = ped.clientes as { nome_razao_social: string; cpf_cnpj: string | null } | null;
    const nome = c?.nome_razao_social || "Sem cliente";
    const key = (ped.cliente_id as string | null) || nome;
    const existing = map.get(key) || { clienteId: (ped.cliente_id as string | null), cliente: nome, cnpj: c?.cpf_cnpj || "-", total: 0, qtd: 0 };
    existing.total += Number(ped.valor_total || 0);
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
  // C-01/DP-04: paginação universal — curva ABC client-side só é correta
  // quando o dataset completo é considerado.
  const data = await fetchAllPages<Record<string, unknown>>(() => {
    let q = supabase
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
      .eq("notas_fiscais.status", "confirmada")
      .order("produto_id", { ascending: true });
    q = withDateRange(q, "notas_fiscais.data_emissao", filtros);
    if (filtros.clienteIds?.length) q = q.in('notas_fiscais.cliente_id', filtros.clienteIds);
    return q;
  });

  const prodMap = new Map<string, { produto: string; codigo: string; total: number }>();
  for (const item of data as Record<string, unknown>[]) {
    const key = item.produto_id || "sem-produto";
    const prod = item.produtos as { nome?: string; codigo_interno?: string } | null;
    const nome = prod?.nome || "Produto removido";
    const codigo = prod?.codigo_interno || "-";
    const existing = prodMap.get(key as string) || { produto: nome, codigo, total: 0 };
    const itemTotal = Number(item.quantidade || 0) * Number(item.valor_unitario || 0);
    existing.total += itemTotal;
    prodMap.set(key as string, existing);
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