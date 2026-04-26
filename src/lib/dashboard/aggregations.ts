import type {
  DailyFinRow,
  DailyNfRow,
  FinRow,
  FiscalStats,
  NfItemRow,
  NfRow,
  ProdRow,
  RecDataRow,
  TopPoint,
} from "@/pages/dashboard/hooks/types";

export const sumOpenFinanceiro = (rows: FinRow[] = []) =>
  rows.reduce((sum, row) => {
    const value = row.status === "parcial"
      ? Number(row.saldo_restante ?? row.valor ?? 0)
      : Number(row.valor ?? 0);
    return sum + value;
  }, 0);

export const sumNfValues = (rows: NfRow[] = []) =>
  rows.reduce((sum, item) => sum + Number(item.valor_total ?? 0), 0);

/**
 * Status canônicos pós-Rodada 5: rascunho | confirmada | cancelada.
 * `pendentes` agrega documentos ainda não autorizados — `rascunho` (legacy)
 * e `pendente` (em trânsito de envio à SEFAZ).
 */
export const summarizeFiscalStats = (rows: NfRow[] = []): FiscalStats => {
  const emitidas = rows.filter((item) => item.status === "confirmada").length;
  const pendentes = rows.filter(
    (item) => item.status === "rascunho" || item.status === "pendente",
  ).length;
  const canceladas = rows.filter((item) => item.status === "cancelada").length;
  const valorEmitidas = rows
    .filter((item) => item.status === "confirmada")
    .reduce((sum, item) => sum + Number(item.valor_total ?? 0), 0);

  return { emitidas, pendentes, canceladas, valorEmitidas };
};

export const filterEstoqueBaixo = (rows: ProdRow[] = []) =>
  rows.filter((item) => item.estoque_minimo > 0 && (item.estoque_atual ?? 0) <= item.estoque_minimo);

export const aggregateTopClientes = (rows: RecDataRow[] = [], limit = 5): TopPoint[] => {
  const map = new Map<string, number>();

  for (const row of rows) {
    const nome = row.clientes?.nome_razao_social ?? "Sem cliente";
    const value = row.status === "parcial"
      ? Number(row.saldo_restante ?? row.valor ?? 0)
      : Number(row.valor ?? 0);
    map.set(nome, (map.get(nome) ?? 0) + value);
  }

  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([nome, valor]) => ({ nome, valor }));
};

export const aggregateTopProdutos = (rows: NfItemRow[] = [], limit = 5): TopPoint[] => {
  const map = new Map<string, number>();

  for (const row of rows) {
    const nome = row.produtos?.nome ?? "Sem produto";
    const value = Number(row.quantidade ?? 0) * Number(row.valor_unitario ?? 0);
    map.set(nome, (map.get(nome) ?? 0) + value);
  }

  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([nome, valor]) => ({ nome, valor }));
};

export const buildIsoDayRange = (fromOffset: number, count: number): string[] =>
  Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + fromOffset + index);
    return date.toISOString().slice(0, 10);
  });

export const toShortDayLabel = (isoDate: string): string => {
  const [, mm, dd] = isoDate.split("-");
  return `${dd}/${mm}`;
};

export const aggregateDailyFinanceiro = (days: string[], rows: DailyFinRow[] = []) => {
  const map = new Map<string, number>(days.map((day) => [day, 0]));

  for (const row of rows) {
    const value = row.status === "parcial"
      ? Number(row.saldo_restante ?? row.valor ?? 0)
      : Number(row.valor ?? 0);
    map.set(row.data_vencimento, (map.get(row.data_vencimento) ?? 0) + value);
  }

  return days.map((day) => ({ dia: toShortDayLabel(day), valor: map.get(day) ?? 0 }));
};

export const aggregateDailyVendas = (days: string[], rows: DailyNfRow[] = []) => {
  const map = new Map<string, number>(days.map((day) => [day, 0]));

  for (const row of rows) {
    map.set(row.data_emissao, (map.get(row.data_emissao) ?? 0) + Number(row.valor_total ?? 0));
  }

  return days.map((day) => ({ dia: toShortDayLabel(day), valor: map.get(day) ?? 0 }));
};

export const computeValorTotalEstoque = (rows: Array<{ estoque_atual: number | null; preco_custo: number | null }> = []) =>
  rows.reduce(
    (sum, row) => sum + (Number(row.estoque_atual ?? 0) * Number(row.preco_custo ?? 0)),
    0,
  );
