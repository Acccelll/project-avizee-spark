/**
 * Loader do relatório "Pedidos a Faturar".
 *
 * Fonte canônica: itens de orçamentos com o pedido do cliente registrado
 * (status `aprovado`, ou `convertido` legado) cujo faturamento ainda está
 * `aberto` ou `parcial`. O saldo de cada item vem de `vw_orcamento_itens_saldo`
 * (quantidade do orçamento − quantidade das NFs vinculadas).
 *
 * Para responder "quantos itens são necessários para despachar", o saldo
 * pendente é confrontado com o estoque disponível do produto
 * (`estoque_atual - estoque_reservado`). O estoque é alocado por ordem de
 * prioridade (previsão de despacho mais próxima primeiro; sem previsão por
 * último), então cada linha mostra quanto já está coberto e quanto falta.
 *
 * Além da lista por item, o resultado traz as visões "Por cliente" e
 * "Por produto" (`views`), montadas sobre as mesmas linhas já alocadas.
 *
 * Quantidades NÃO são totalizadas no rodapé: o relatório mistura unidades
 * (DZ, UN, CX…), e somá-las não tem significado.
 */

import { supabase } from "@/integrations/supabase/client";
import type { FiltroRelatorio, RelatorioResultado } from "@/services/relatorios/lib/shared";
import { fetchAllPages } from "@/services/relatorios/lib/fetchAllPages";
import { CANAL_LABEL, type CanalVenda } from "@/services/comercial/pedidoDireto.service";

/** Status do orçamento que representam pedido registrado. */
export const ORCAMENTO_STATUS_PEDIDO = ["aprovado", "convertido"] as const;
/** Situações de faturamento que ainda têm saldo a despachar. */
export const FATURAMENTO_EM_ABERTO = ["aberto", "parcial"] as const;

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

/** Gravidade para resumir várias linhas numa só (visões por cliente/produto). */
const SITUACAO_PESO: Record<SituacaoEstoque, number> = {
  atendido: 0,
  sem_cadastro: 1,
  parcial: 2,
  sem_estoque: 3,
};

export interface ItemPendente {
  itemId: string;
  orcamentoId: string;
  /** Nº do pedido do cliente (ou OC); cai para o nº do orçamento. */
  pedido: string;
  orcamento: string;
  /** Canal de venda (rótulo): Orçamento, WhatsApp, Mercado Livre… */
  canal: string;
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
  /** Aviso interno do grupo do produto (ex.: "Informar o lote"); vazio quando não há. */
  aviso: string;
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

export interface LinhaPorCliente {
  clienteId?: string;
  cliente: string;
  pedidos: number;
  itens: number;
  previsao: string | null;
  valorPendente: number;
  itensComFalta: number;
  atrasados: number;
  situacao: string;
  statusKey: SituacaoEstoque;
  statusKind: LinhaPedidoAFaturar["statusKind"];
}

export interface LinhaPorProduto {
  produtoId: string | null;
  codigo: string | null;
  produto: string;
  aviso: string;
  unidade: string;
  pedidos: number;
  previsao: string | null;
  qtdPendente: number;
  estoqueDisponivel: number | null;
  falta: number;
  valorPendente: number;
  situacao: string;
  statusKey: SituacaoEstoque;
  statusKind: LinhaPedidoAFaturar["statusKind"];
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
  return a.orcamento.localeCompare(b.orcamento);
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

function piorSituacao(atual: SituacaoEstoque | undefined, nova: SituacaoEstoque): SituacaoEstoque {
  return !atual || SITUACAO_PESO[nova] > SITUACAO_PESO[atual] ? nova : atual;
}

function menorData(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

/** Visão "Por cliente": carteira de cada cliente, com a pior situação de estoque. */
export function agruparPorCliente(rows: LinhaPedidoAFaturar[]): LinhaPorCliente[] {
  const grupos = new Map<string, { base: LinhaPorCliente; pedidos: Set<string>; atrasados: Set<string> }>();
  for (const r of rows) {
    const chave = r.clienteId ?? `nome:${r.cliente}`;
    let g = grupos.get(chave);
    if (!g) {
      g = {
        base: {
          clienteId: r.clienteId, cliente: r.cliente, pedidos: 0, itens: 0, previsao: null,
          valorPendente: 0, itensComFalta: 0, atrasados: 0,
          situacao: "", statusKey: r.statusKey, statusKind: r.statusKind,
        },
        pedidos: new Set(),
        atrasados: new Set(),
      };
      grupos.set(chave, g);
    }
    const b = g.base;
    g.pedidos.add(r.orcamentoId);
    if (r.atrasado) g.atrasados.add(r.orcamentoId);
    b.itens += 1;
    b.valorPendente += r.valorPendente;
    if (r.falta > 0) b.itensComFalta += 1;
    b.previsao = menorData(b.previsao, r.previsao);
    b.statusKey = piorSituacao(b.statusKey, r.statusKey);
  }
  return [...grupos.values()]
    .map(({ base, pedidos, atrasados }) => ({
      ...base,
      pedidos: pedidos.size,
      atrasados: atrasados.size,
      valorPendente: round2(base.valorPendente),
      situacao: SITUACAO_LABEL[base.statusKey],
      statusKind: SITUACAO_KIND[base.statusKey],
    }))
    .sort((a, b) => b.valorPendente - a.valorPendente);
}

/** Visão "Por produto": quanto está pedido, quanto há em estoque e quanto falta. */
export function agruparPorProduto(rows: LinhaPedidoAFaturar[]): LinhaPorProduto[] {
  const grupos = new Map<string, { base: LinhaPorProduto; pedidos: Set<string> }>();
  for (const r of rows) {
    const chave = r.produtoId ? `${r.produtoId}|${r.unidade}` : `sem:${r.codigo ?? ""}|${r.produto}|${r.unidade}`;
    let g = grupos.get(chave);
    if (!g) {
      g = {
        base: {
          produtoId: r.produtoId, codigo: r.codigo, produto: r.produto, aviso: r.aviso, unidade: r.unidade,
          pedidos: 0, previsao: null, qtdPendente: 0, estoqueDisponivel: r.estoqueDisponivel,
          falta: 0, valorPendente: 0, situacao: "", statusKey: r.statusKey, statusKind: r.statusKind,
        },
        pedidos: new Set(),
      };
      grupos.set(chave, g);
    }
    const b = g.base;
    g.pedidos.add(r.orcamentoId);
    b.qtdPendente += r.qtdPendente;
    b.falta += r.falta;
    b.valorPendente += r.valorPendente;
    b.previsao = menorData(b.previsao, r.previsao);
    b.statusKey = piorSituacao(b.statusKey, r.statusKey);
  }
  return [...grupos.values()]
    .map(({ base, pedidos }) => ({
      ...base,
      pedidos: pedidos.size,
      valorPendente: round2(base.valorPendente),
      situacao: SITUACAO_LABEL[base.statusKey],
      statusKind: SITUACAO_KIND[base.statusKey],
    }))
    .sort((a, b) => b.falta - a.falta || b.valorPendente - a.valorPendente);
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

/** `.in()` vai na URL: consulta em blocos para não estourar o tamanho. */
const LOTE_IDS = 150;

function lotes<T>(lista: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < lista.length; i += LOTE_IDS) out.push(lista.slice(i, i + LOTE_IDS));
  return out;
}

interface RawOrcamento {
  id: string;
  numero: string;
  pedido_cliente: string | null;
  data_pedido_cliente: string | null;
  data_orcamento: string | null;
  previsao_despacho: string | null;
  cliente_id: string | null;
  canal: string | null;
  clientes: { nome_razao_social: string | null; nome_fantasia: string | null } | null;
}

interface RawItem {
  id: string;
  orcamento_id: string;
  produto_id: string | null;
  codigo_snapshot: string | null;
  descricao_snapshot: string | null;
  variacao: string | null;
  quantidade: number | null;
  unidade: string | null;
  valor_unitario: number | null;
  produtos: {
    codigo_interno: string | null;
    nome: string | null;
    estoque_atual: number | null;
    estoque_reservado: number | null;
    grupos_produto: { aviso_interno: string | null } | null;
  } | null;
}

interface RawSaldo {
  orcamento_item_id: string | null;
  quantidade_faturada: number | null;
}

export async function loadPedidosAFaturar(filtros: FiltroRelatorio): Promise<RelatorioResultado> {
  const orcamentos = await fetchAllPages<RawOrcamento>(() => {
    let q = supabase
      .from("orcamentos")
      .select(
        `id, numero, pedido_cliente, data_pedido_cliente, data_orcamento, previsao_despacho, cliente_id, canal,
         clientes(nome_razao_social, nome_fantasia)`,
      )
      .eq("ativo", true)
      .in("status", [...ORCAMENTO_STATUS_PEDIDO])
      .in("faturamento_status", [...FATURAMENTO_EM_ABERTO])
      .order("data_orcamento", { ascending: true });
    if (filtros.clienteIds?.length) q = q.in("cliente_id", filtros.clienteIds);
    if (filtros.tipos?.length) q = q.in("canal", filtros.tipos);
    return q;
  });

  const porId = new Map(orcamentos.map((o) => [o.id, o]));
  const ids = [...porId.keys()];
  const itensRaw: RawItem[] = [];
  const faturadoPorItem = new Map<string, number>();

  for (const lote of lotes(ids)) {
    const [itens, saldos] = await Promise.all([
      fetchAllPages<RawItem>(() =>
        supabase
          .from("orcamentos_itens")
          .select(
            `id, orcamento_id, produto_id, codigo_snapshot, descricao_snapshot, variacao, quantidade,
             unidade, valor_unitario,
             produtos(codigo_interno, nome, estoque_atual, estoque_reservado, grupos_produto(aviso_interno))`,
          )
          .in("orcamento_id", lote)
          .order("created_at", { ascending: true }),
      ),
      fetchAllPages<RawSaldo>(() =>
        supabase
          .from("vw_orcamento_itens_saldo")
          .select("orcamento_item_id, quantidade_faturada")
          .in("orcamento_id", lote),
      ),
    ]);
    itensRaw.push(...itens);
    for (const s of saldos) {
      if (s.orcamento_item_id) faturadoPorItem.set(s.orcamento_item_id, Number(s.quantidade_faturada ?? 0));
    }
  }

  const itens: ItemPendente[] = [];
  for (const raw of itensRaw) {
    const orc = porId.get(raw.orcamento_id);
    if (!orc) continue;
    const qtdPedida = Number(raw.quantidade ?? 0);
    const qtdFaturada = faturadoPorItem.get(raw.id) ?? 0;
    const qtdPendente = qtdPedida - qtdFaturada;
    if (qtdPendente <= 0) continue;

    const descricao = raw.descricao_snapshot || raw.produtos?.nome || "-";
    const produto = raw.variacao ? `${descricao} — ${raw.variacao}` : descricao;
    const estoque = raw.produtos
      ? Number(raw.produtos.estoque_atual ?? 0) - Number(raw.produtos.estoque_reservado ?? 0)
      : null;

    itens.push({
      itemId: raw.id,
      orcamentoId: orc.id,
      pedido: orc.pedido_cliente || orc.numero,
      orcamento: orc.numero,
      canal: CANAL_LABEL[(orc.canal ?? "orcamento") as CanalVenda] ?? orc.canal ?? "",
      clienteId: orc.cliente_id ?? undefined,
      cliente: orc.clientes?.nome_fantasia || orc.clientes?.nome_razao_social || "-",
      emissao: orc.data_pedido_cliente ?? orc.data_orcamento,
      previsao: orc.previsao_despacho,
      produtoId: raw.produto_id,
      codigo: raw.codigo_snapshot || raw.produtos?.codigo_interno || null,
      produto,
      unidade: raw.unidade || "-",
      qtdPedida,
      qtdFaturada,
      qtdPendente,
      valorUnitario: Number(raw.valor_unitario ?? 0),
      estoqueDisponivel: estoque,
      aviso: raw.produtos?.grupos_produto?.aviso_interno?.trim() ?? "",
    });
  }

  const rows = alocarEstoque(itens, hojeLocalIso());
  const porCliente = agruparPorCliente(rows);
  const porProduto = agruparPorProduto(rows);

  const valorPendente = round2(rows.reduce((s, r) => s + r.valorPendente, 0));
  const pedidos = new Set(rows.map((r) => r.orcamentoId)).size;
  const itensComFalta = rows.filter((r) => r.falta > 0).length;
  const atrasados = new Set(rows.filter((r) => r.atrasado).map((r) => r.orcamentoId)).size;

  const chartData = porCliente.map((c) => ({ name: c.cliente, value: c.valorPendente }));

  return {
    title: "Pedidos a faturar",
    subtitle:
      "Itens de pedidos registrados nos orçamentos com saldo a faturar, confrontados com o estoque disponível.",
    rows: rows as unknown as Record<string, unknown>[],
    views: {
      cliente: porCliente as unknown as Record<string, unknown>[],
      produto: porProduto as unknown as Record<string, unknown>[],
    },
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
