/**
 * Pure aggregation and transformation helpers for the Reports module.
 *
 * All functions are side-effect-free so they can be unit-tested without mocks.
 */

import type { VendasRow, AgingRow, CurvaAbcRow } from "@/types/relatorios";
import type { TipoRelatorio } from "@/services/relatorios.service";

// ─── Sales aggregation ───────────────────────────────────────────────────────

/** Groups an array of VendasRow by a time period and returns chart-ready data. */
export function agruparVendasPorPeriodo(
  rows: VendasRow[],
  agrupamento: "dia" | "semana" | "mes" | "padrao" = "mes"
): Array<{ name: string; value: number }> {
  if (!rows.length) return [];

  const bucket = new Map<string, number>();

  for (const row of rows) {
    const date = row.emissao ? row.emissao.slice(0, 10) : "s/d";
    let key: string;

    if (agrupamento === "dia") {
      key = date;
    } else if (agrupamento === "semana") {
      key = getWeekLabel(date);
    } else {
      // "mes" and "padrao" both aggregate by month
      key = date.slice(0, 7); // "YYYY-MM"
    }

    bucket.set(key, (bucket.get(key) ?? 0) + row.valor);
  }

  return Array.from(bucket.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({ name: formatPeriodLabel(key, agrupamento), value }));
}

function getWeekLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  );
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function formatPeriodLabel(
  key: string,
  agrupamento: "dia" | "semana" | "mes" | "padrao"
): string {
  if (agrupamento === "dia") {
    const [y, m, d] = key.split("-");
    return `${d}/${m}/${y}`;
  }
  if (agrupamento === "semana") return key; // e.g. "2024-W03"
  // mes / padrao: "YYYY-MM" → "MMM/YY"
  if (/^\d{4}-\d{2}$/.test(key)) {
    const [y, m] = key.split("-");
    const date = new Date(Number(y), Number(m) - 1, 1);
    return date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
  }
  return key;
}

// ─── Ranking helpers ─────────────────────────────────────────────────────────

/** Adds a `participacao` (% share of total) field to each row in a ranking. */
export function addParticipacao<T extends { valorTotal: number }>(
  rows: T[],
  grandTotal: number
): (T & { participacao: number })[] {
  return rows.map((r) => ({
    ...r,
    participacao:
      grandTotal > 0 ? Number(((r.valorTotal / grandTotal) * 100).toFixed(1)) : 0,
  }));
}

/** Computes top-N concentration (% of grand total held by the first N items). */
export function computeTop5Concentracao(
  rows: { valorTotal: number }[],
  grandTotal: number
): number {
  if (grandTotal <= 0) return 0;
  const top5Total = rows.slice(0, 5).reduce((s, r) => s + r.valorTotal, 0);
  return Number(((top5Total / grandTotal) * 100).toFixed(1));
}

// ─── Aging helpers ───────────────────────────────────────────────────────────

export type AgingFaixa = "A vencer" | "1-30 dias" | "31-60 dias" | "61-90 dias" | "90+ dias";

/** Returns the aging band for a given overdue-days count. */
export function calcularFaixaAging(diasVencido: number): AgingFaixa {
  if (diasVencido <= 0) return "A vencer";
  if (diasVencido <= 30) return "1-30 dias";
  if (diasVencido <= 60) return "31-60 dias";
  if (diasVencido <= 90) return "61-90 dias";
  return "90+ dias";
}

/** Aggregates AgingRows into chart data grouped by faixa. */
export function agruparAgingPorFaixa(
  rows: AgingRow[]
): Array<{ name: AgingFaixa; value: number }> {
  const faixas: AgingFaixa[] = [
    "A vencer",
    "1-30 dias",
    "31-60 dias",
    "61-90 dias",
    "90+ dias",
  ];
  return faixas.map((f) => ({
    name: f,
    value: rows.filter((r) => r.faixa === f).reduce((s, r) => s + r.valor, 0),
  }));
}

// ─── Row filtering ────────────────────────────────────────────────────────────

/** Filters a generic rows array by a status substring (case-insensitive). */
export function filtrarPorStatus<T extends Record<string, unknown>>(
  rows: T[],
  statusFiltro: string,
  options?: { statusField?: string }
): T[] {
  if (statusFiltro === "todos") return rows;
  const wanted = statusFiltro.toLowerCase();
  return rows.filter((r) => {
    // Prefer canonical statusKey when present (no substring heuristics).
    const key = r["statusKey"];
    if (typeof key === "string" && key) return key.toLowerCase() === wanted;
    // Fallback for rows that haven't been migrated yet.
    const status = String(
      r["status"] ?? r["situacao"] ?? r["faturamento"] ?? ""
    ).toLowerCase();
    return status.includes(wanted);
  });
}

/**
 * Sorts rows by a common sort key.
 *
 * For "valor_desc": prefers `valor` / `valorTotal`. When neither exists (e.g.
 * fluxo de caixa rows have `entrada` / `saida` / `saldo` instead), falls back
 * to `entrada + saida` so the user gets a meaningful order instead of a no-op.
 */
export function sortarRows<T extends Record<string, unknown>>(
  rows: T[],
  agrupamento: "padrao" | "valor_desc" | "status" | "vencimento",
  options?: { statusField?: string; valueSortField?: string; dateSortField?: string }
): T[] {
  const copy = [...rows];
  if (agrupamento === "valor_desc") {
    const valueOf = (r: T): number => {
      const direct = (options?.valueSortField ? r[options.valueSortField] : undefined) ?? r["valor"] ?? r["valorTotal"];
      if (direct != null) return Number(direct);
      const entrada = Number(r["entrada"] ?? 0);
      const saida = Number(r["saida"] ?? 0);
      return entrada + saida;
    };
    return copy.sort((a, b) => valueOf(b) - valueOf(a));
  }
  if (agrupamento === "vencimento") {
    return copy.sort((a, b) =>
      String((options?.dateSortField ? a[options.dateSortField] : undefined) ?? a["vencimento"] ?? a["data"] ?? "").localeCompare(
        String((options?.dateSortField ? b[options.dateSortField] : undefined) ?? b["vencimento"] ?? b["data"] ?? "")
      )
    );
  }
  if (agrupamento === "status") {
    return copy.sort((a, b) =>
      normalizeSemanticToken((options?.statusField ? a[options.statusField] : undefined) ?? a["status"] ?? a["situacao"] ?? "").localeCompare(
        normalizeSemanticToken((options?.statusField ? b[options.statusField] : undefined) ?? b["status"] ?? b["situacao"] ?? ""),
        "pt-BR"
      )
    );
  }
  return copy;
}

export type SemanticBadgeTone = "default" | "success" | "warning" | "destructive" | "secondary" | "outline";

const BADGE_TONE_MAP: Array<{ match: RegExp; tone: SemanticBadgeTone }> = [
  { match: /(vencid|atras|zerad|ruptura|diverg|pendente|negativ|critic|erro|falha|cancelad|c)\b/i, tone: "destructive" },
  { match: /(atenc|abaixo|minim|risco|b|parcial)/i, tone: "warning" },
  { match: /(ok|pago|faturad|confirmad|entreg|regular|a)\b/i, tone: "success" },
];

export function classifyBadgeTone(
  raw: unknown,
  ctx?: { reportId?: TipoRelatorio; columnKey?: string }
): SemanticBadgeTone {
  if (typeof raw !== "string") return "secondary";
  const value = normalizeSemanticToken(raw);
  if (!value || value === "-") return "secondary";
  if (ctx?.reportId === "curva_abc" && ctx.columnKey === "classe") {
    if (value === "a") return "success";
    if (value === "b") return "warning";
    return "destructive";
  }
  const match = BADGE_TONE_MAP.find((def) => def.match.test(value));
  return match?.tone ?? "secondary";
}

export function normalizeSemanticToken(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

// ─── Curva ABC ───────────────────────────────────────────────────────────────

export interface CurvaAbcInput {
  codigo: string;
  produto: string;
  faturamento: number;
}

/**
 * Classifies products into ABC curve classes.
 *
 * Class A: top items that together represent up to 80% of total revenue.
 * Class B: items from 80% to 95% of accumulated revenue.
 * Class C: remaining items (95-100%).
 *
 * Returns rows sorted by faturamento descending, with posicao, percentual,
 * acumulado and classe filled in.
 */
export function calcularCurvaABC(items: CurvaAbcInput[]): CurvaAbcRow[] {
  if (!items.length) return [];

  const sorted = [...items].sort((a, b) => b.faturamento - a.faturamento);
  const grandTotal = sorted.reduce((s, i) => s + i.faturamento, 0);

  if (grandTotal <= 0) {
    return sorted.map((item, idx) => ({
      posicao: idx + 1,
      codigo: item.codigo,
      produto: item.produto,
      faturamento: item.faturamento,
      percentual: 0,
      acumulado: 0,
      classe: "C" as const,
    }));
  }

  let acumulado = 0;
  return sorted.map((item, idx) => {
    const percentual = Number(((item.faturamento / grandTotal) * 100).toFixed(2));
    acumulado = Number((acumulado + percentual).toFixed(2));
    const classe: "A" | "B" | "C" =
      acumulado <= 80 ? "A" : acumulado <= 95 ? "B" : "C";
    return {
      posicao: idx + 1,
      codigo: item.codigo,
      produto: item.produto,
      faturamento: item.faturamento,
      percentual,
      acumulado,
      classe,
    };
  });
}

// ─── Giro de Estoque ─────────────────────────────────────────────────────────

export interface GiroEstoqueInput {
  codigo: string;
  produto: string;
  custoVendas: number;
  estoqueAtual: number;
  custoUnit: number;
}

export interface GiroEstoqueRow {
  codigo: string;
  produto: string;
  custoVendas: number;
  estoqueAtual: number;
  estoqueValor: number;
  giro: number;
}

/**
 * Calculates stock turnover (giro de estoque) for each product.
 *
 * giro = custoVendas / estoqueValor  (where estoqueValor = estoqueAtual * custoUnit)
 *
 * A giro of 0 means no movement or zero stock value.
 */
export function calcularGiroEstoque(items: GiroEstoqueInput[]): GiroEstoqueRow[] {
  return items.map((item) => {
    const estoqueValor = item.estoqueAtual * item.custoUnit;
    const giro =
      estoqueValor > 0
        ? Number((item.custoVendas / estoqueValor).toFixed(2))
        : 0;
    return {
      codigo: item.codigo,
      produto: item.produto,
      custoVendas: item.custoVendas,
      estoqueAtual: item.estoqueAtual,
      estoqueValor: Number(estoqueValor.toFixed(2)),
      giro,
    };
  });
}

// ─── Ticket Médio ─────────────────────────────────────────────────────────────

/**
 * Calculates the average ticket (ticket médio) from a list of VendasRow.
 *
 * Returns 0 when the input is empty.
 */
export function calcularTicketMedio(rows: VendasRow[]): number {
  if (!rows.length) return 0;
  const total = rows.reduce((s, r) => s + r.valor, 0);
  return Number((total / rows.length).toFixed(2));
}
