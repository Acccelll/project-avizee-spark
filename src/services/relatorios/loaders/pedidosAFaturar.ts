/**
 * Loader do relatório "Pedidos a Faturar".
 *
 * Fonte canônica: itens de ordens de venda (orçamento aprovado →
 * `converter_orcamento_em_ov` → OV) que ainda têm saldo a faturar
 * (`quantidade - quantidade_faturada > 0`).
 *
 * Para responder "quantos itens são necessários para despachar", o saldo
 * pendente é confrontado com o estoque disponível do produto
 * (`estoque_atual - estoque_reservado`). O estoque é alocado por ordem de
 * prioridade (previsão de despacho mais próxima primeiro; sem previsão por
 * último), então cada linha mostra quanto já está coberto e quanto falta.
 *
 * Quantidades NÃO são totalizadas no rodapé: o relatório mistura unidades
 * (DZ, UN, CX…), e somá-las não tem significado.
 */

import { supabase } from "@/integrations/supabase/client";
import { resolveStatus, ordemVendaStatusMap } from "@/services/relatorios/lib/statusMap";
import type { FiltroRelatorio, RelatorioResultado } from "@/services/relatorios/lib/shared";
import { fetchAllPages } from "@/services/relatorios/lib/fetchAllPages";

/** Status de OV que representam compromisso de despacho ainda em aberto. */
export const OV_STATUS_A_FATURAR = ["aprovada", "em_separacao", "faturada_parcial"] as const;

export type SituacaoEstoque = "atendido" | "parcial" | "sem_estoque" | "sem_cadastro";

export const SITUACAO_LABEL: Record<SituacaoEstoque, string> = {
  atendido: "Estoque OK",
  parcial: "Estoque parcial",
  sem_estoque: "Sem estoque",
  sem_cadastro: "Item sem cadastro",
};

const SITUACAO_KIND: Record<SituacaoEstoque, "success" | "warning" | "critical" | "neutral"> = {
  atendido: "success",
  parcial: "warning",
  sem_estoque: "critical",
  sem_cadastro: "neutral",
};

export interface ItemPendente {
  itemId: string;
  ordemVendaId: string;
  numero: string;
  statusOv: string;
  clienteId?: string;
  cliente: string;
  emissao: string | null;
  previsao: string | null;
  produtoId: string | null;
  codigo: string | null;
  produto: string;
  unidade: string;
  qtdPedida: number;
  qtdFaturada: number;
  qtdPendente: number;
  valorUnitario: number;
  estoqueDisponivel: number | null;
}

export interface LinhaPedidoAFaturar extends Omit<ItemPendente, "estoqueDisponivel"> {
  valorPendente: number;
  estoqueDisponivel: number | null;
  qtdAtendida: number;
  falta: number;
  atrasado: boolean;
  situacao: string;
  statusKey: SituacaoEstoque;
  statusKind: "success" | "warning" | "critical" | "neutral";
}

/** Ordem de prioridade: previsão mais próxima; sem previsão por último; depois emissão e nº. */
function compararPrioridade(a: ItemPendente, b: ItemPendente): number {
  if (a.previsao !== b.previsao) {
    if (!a.previsao) return 1;
    if (!b.previsao) return -1;
    return a.previsao.localeCompare(b.previsao);
  }
  const e = (a.emissao ?? "").localeCompare(b.emissao ?? "");
  if (e !== 0) return e;
  return a.numero.localeCompare(b.numero);
}

/**
 * Aloca o estoque disponível de cada produto entre os itens pendentes,
 * na ordem de prioridade. Função pura (testável).
 */
export function alocarEstoque(itens: ItemPendente[], hojeIso: string): LinhaPedidoAFaturar[] {
  const ordenados = [...itens].sort(compararPrioridade);
  const restante = new Map<string, number>();

  return ordenados.map((item) => {
    let qtdAtendida = 0;
    let statusKey: SituacaoEstoque;

    if (!item.produtoId || item.estoqueDisponivel == null) {
      statusKey = "sem_cadastro";
    } else {
      if (!restante.has(item.produtoId)) {
        restante.set(item.produtoId, Math.max(item.estoqueDisponivel, 0));
      }
      const saldo = restante.get(item.produtoId) ?? 0;
      qtdAtendida = Math.min(item.qtdPendente, saldo);
      restante.set(item.produtoId, saldo - qtdAtendida);
      statusKey =
        qtdAtendida >= item.qtdPendente ? "atendido" : qtdAtendida > 0 ? "parcial" : "sem_estoque";
    }

    const falta = statusKey === "sem_cadastro" ? item.qtdPendente : item.qtdPendente - qtdAtendida;

    return {
      ...item,
      valorPendente: round2(item.qtdPendente * item.valorUnitario),
      qtdAtendida,
      falta,
      atrasado: !!item.previsao && item.previsao < hojeIso,
      situacao: SITUACAO_LABEL[statusKey],
      statusKey,
      statusKind: SITUACAO_KIND[statusKey],
    };
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function hojeLocalIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

interface RawItem {
  id: string;
  produto_id: string | null;
  codigo_snapshot: string | null;
  descricao_snapshot: string | null;
  variacao: string | null;
  quantidade: number | null;
  quantidade_faturada: number | null;
  unidade: string | null;
  valor_unitario: number | null;
  ordens_venda: {
    id: string;
    numero: string;
    status: string;
    data_emissao: string | null;
    data_prometida_despacho: string | null;
    cliente_id: string | null;
    clientes: { nome_razao_social: string | null; nome_fantasia: string | null } | null;
  } | null;
  produtos: {
    codigo_interno: string | null;
    nome: string | null;
    estoque_atual: number | null;
    estoque_reservado: number | null;
  } | null;
}

export async function loadPedidosAFaturar(filtros: FiltroRelatorio): Promise<RelatorioResultado> {
  const data = await fetchAllPages<RawItem>(() => {
    let q = supabase
      .from("ordens_venda_itens")
      .select(
        `id, produto_id, codigo_snapshot, descricao_snapshot, variacao, quantidade,
         quantidade_faturada, unidade, valor_unitario,
         ordens_venda!inner(id, numero, status, data_emissao, data_prometida_despacho, cliente_id,
           clientes(nome_razao_social, nome_fantasia)),
         produtos(codigo_interno, nome, estoque_atual, estoque_reservado)`,
      )
      .eq("ordens_venda.ativo", true)
      .in("ordens_venda.status", [...OV_STATUS_A_FATURAR])
      .order("created_at", { ascending: true });
    if (filtros.clienteIds?.length) q = q.in("ordens_venda.cliente_id", filtros.clienteIds);
    return q;
  });

  const itens: ItemPendente[] = [];
  for (const raw of data) {
    const ov = raw.ordens_venda;
    if (!ov) continue;
    const qtdPedida = Number(raw.quantidade ?? 0);
    const qtdFaturada = Number(raw.quantidade_faturada ?? 0);
    const qtdPendente = qtdPedida - qtdFaturada;
    if (qtdPendente <= 0) continue;

    const descricao = raw.descricao_snapshot || raw.produtos?.nome || "-";
    const produto = raw.variacao ? `${descricao} — ${raw.variacao}` : descricao;
    const estoque = raw.produtos
      ? Number(raw.produtos.estoque_atual ?? 0) - Number(raw.produtos.estoque_reservado ?? 0)
      : null;

    itens.push({
      itemId: raw.id,
      ordemVendaId: ov.id,
      numero: ov.numero,
      statusOv: resolveStatus(ordemVendaStatusMap, ov.status).key,
      clienteId: ov.cliente_id ?? undefined,
      cliente: ov.clientes?.nome_fantasia || ov.clientes?.nome_razao_social || "-",
      emissao: ov.data_emissao,
      previsao: ov.data_prometida_despacho,
      produtoId: raw.produto_id,
      codigo: raw.codigo_snapshot || raw.produtos?.codigo_interno || null,
      produto,
      unidade: raw.unidade || "-",
      qtdPedida,
      qtdFaturada,
      qtdPendente,
      valorUnitario: Number(raw.valor_unitario ?? 0),
      estoqueDisponivel: estoque,
    });
  }

  const rows = alocarEstoque(itens, hojeLocalIso());

  const valorPendente = round2(rows.reduce((s, r) => s + r.valorPendente, 0));
  const pedidos = new Set(rows.map((r) => r.ordemVendaId)).size;
  const itensComFalta = rows.filter((r) => r.falta > 0).length;
  const atrasados = new Set(rows.filter((r) => r.atrasado).map((r) => r.ordemVendaId)).size;

  const porCliente = new Map<string, number>();
  for (const r of rows) porCliente.set(r.cliente, (porCliente.get(r.cliente) ?? 0) + r.valorPendente);
  const chartData = [...porCliente.entries()]
    .map(([name, value]) => ({ name, value: round2(value) }))
    .sort((a, b) => b.value - a.value);

  return {
    title: "Pedidos a faturar",
    subtitle:
      "Itens de pedidos de venda aprovados com saldo a faturar, confrontados com o estoque disponível.",
    rows: rows as unknown as Record<string, unknown>[],
    chartData,
    totals: { valorPendente },
    kpis: { valorPendente, pedidos, itensComFalta, atrasados },
    meta: {
      kind: "list",
      valueNature: "misto",
      drillDownReady: true,
    },
  };
}
