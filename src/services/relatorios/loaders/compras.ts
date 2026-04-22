/**
 * Loaders para relatórios de compras:
 *  - compras (pedidos)
 *  - compras_fornecedor (ranking)
 */

import { supabase } from "@/integrations/supabase/client";
import { addParticipacao, computeTop5Concentracao } from "@/utils/relatorios";
import { compraStatusMap, resolveStatus } from "@/services/relatorios/lib/statusMap";
import {
  withDateRange,
  type FiltroRelatorio,
  type RelatorioResultado,
  type RawComprasItem,
} from "@/services/relatorios/lib/shared";

export async function loadCompras(filtros: FiltroRelatorio): Promise<RelatorioResultado> {
  let query = supabase
    .from("compras")
    .select("id, fornecedor_id, numero, data_compra, data_entrega_prevista, data_entrega_real, valor_total, status, fornecedores(nome_razao_social)")
    .eq("ativo", true)
    .order("data_compra", { ascending: false });

  query = withDateRange(query, "data_compra", filtros);
  if (filtros.fornecedorIds?.length) query = query.in('fornecedor_id', filtros.fornecedorIds);
  const { data, error } = await query;
  if (error) throw error;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const rows = (data || []).map((raw: RawComprasItem & { id?: string; fornecedor_id?: string | null }) => {
    const item = raw;
    const prevista = item.data_entrega_prevista ? new Date(item.data_entrega_prevista) : null;
    const entregaReal = item.data_entrega_real;
    const statusVal = item.status || '-';
    const emAberto = ['pendente', 'aprovado', 'em_transito'].includes(statusVal);
    const atraso = (prevista && emAberto && prevista < hoje)
      ? Math.floor((hoje.getTime() - prevista.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    const stMeta = resolveStatus(compraStatusMap, statusVal);
    return {
      compraId: item.id,
      fornecedorId: item.fornecedor_id ?? undefined,
      numero: item.numero,
      fornecedor: item.fornecedores?.nome_razao_social || "-",
      compra: item.data_compra,
      prevista: item.data_entrega_prevista,
      entrega: entregaReal,
      valor: Number(item.valor_total || 0),
      atraso,
      status: statusVal,
      statusKey: stMeta.key,
      statusKind: stMeta.kind,
    };
  });

  const totalComprado = rows.reduce((s, r) => s + r.valor, 0);
  const emAberto = rows.filter((r) => ['pendente', 'aprovado', 'em_transito'].includes(r.status)).length;
  const atrasadas = rows.filter((r) => r.atraso > 0).length;

  return {
    title: "Compras",
    subtitle: "Pedidos de compra — entrega prevista, real e situação.",
    rows,
    chartData: rows.slice(0, 8).map((row) => ({ name: row.fornecedor, value: row.valor })),
    kpis: { qtdCompras: rows.length, totalComprado, emAberto, atrasadas },
    meta: {
      kind: 'list',
      valueNature: 'monetario',
      timeAxis: { field: 'criacao', label: 'data da compra', required: false },
      drillDownReady: true,
    },
  };
}

export async function loadComprasFornecedor(filtros: FiltroRelatorio): Promise<RelatorioResultado> {
  let query = supabase
    .from("compras")
    .select("fornecedor_id, valor_total, fornecedores(nome_razao_social, cpf_cnpj)")
    .eq("ativo", true);
  query = withDateRange(query, "data_compra", filtros);
  if (filtros.fornecedorIds?.length) query = query.in('fornecedor_id', filtros.fornecedorIds);
  const { data, error } = await query;
  if (error) throw error;

  const map = new Map<string, { fornecedorId: string | null; fornecedor: string; cnpj: string; total: number; qtd: number }>();
  for (const c of data || []) {
    const f = c.fornecedores as { nome_razao_social: string; cpf_cnpj: string | null } | null;
    const nome = f?.nome_razao_social || "Sem fornecedor";
    const key = ((c as Record<string, unknown>).fornecedor_id as string | null) || nome;
    const existing = map.get(key) || { fornecedorId: ((c as Record<string, unknown>).fornecedor_id as string | null), fornecedor: nome, cnpj: f?.cpf_cnpj || "-", total: 0, qtd: 0 };
    existing.total += Number(c.valor_total || 0);
    existing.qtd += 1;
    map.set(key, existing);
  }

  const rows = Array.from(map.values()).sort((a, b) => b.total - a.total).map((r, i) => ({
    posicao: i + 1, fornecedorId: r.fornecedorId ?? undefined, fornecedor: r.fornecedor, cnpj: r.cnpj, pedidos: r.qtd, valorTotal: r.total,
    ticketMedio: r.qtd > 0 ? r.total / r.qtd : 0,
  }));

  const totalCompradoCf = rows.reduce((s, r) => s + r.valorTotal, 0);
  const rowsWithParticipacao = addParticipacao(rows, totalCompradoCf);

  const fornecedoresAtivos = rowsWithParticipacao.length;
  const totalPedidosCf = rowsWithParticipacao.reduce((s, r) => s + r.pedidos, 0);
  const ticketMedioGeral = totalPedidosCf > 0 ? totalCompradoCf / totalPedidosCf : 0;
  const top5Concentracao = computeTop5Concentracao(rowsWithParticipacao, totalCompradoCf);

  return {
    title: "Compras por Fornecedor",
    subtitle: "Ranking de fornecedores por volume de compras.",
    rows: rowsWithParticipacao,
    chartData: rowsWithParticipacao.slice(0, 8).map(r => ({ name: r.fornecedor.substring(0, 20), value: r.valorTotal })),
    kpis: { totalComprado: totalCompradoCf, fornecedoresAtivos, ticketMedioGeral, top5Concentracao },
    meta: {
      kind: 'ranking',
      valueNature: 'monetario',
      timeAxis: { field: 'criacao', label: 'data da compra', required: false },
      drillDownReady: true,
    },
  };
}