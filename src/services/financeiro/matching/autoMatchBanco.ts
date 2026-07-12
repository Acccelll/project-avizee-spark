/**
 * Núcleo puro de auto-conciliação bancária.
 *
 * Extraído do hook `useConciliacao` para permitir testes unitários e reuso
 * consistente entre "Conciliar automaticamente" (data + valor) e
 * "Match por valor" (apenas valor).
 *
 * Regras (paridade com Conciliação de Cartão):
 *  - Filtra por sinal do valor do extrato (>=0 → "receber"; <0 → "pagar").
 *  - Tolerância de valor de 0,02 (2 centavos) para arredondamentos bancários.
 *  - Janela de data de ±3 dias por padrão; desligada quando `soValor=true`.
 *  - Desempate por proximidade de data; recusa quando há empate exato entre
 *    os dois melhores candidatos (evita match ambíguo).
 */

export interface AutoMatchExtrato {
  id: string;
  data: string;
  valor: number;
}

export interface AutoMatchLancamento {
  id: string;
  valor: number | string;
  tipo: "receber" | "pagar" | string;
  data_vencimento?: string | null;
}

export interface AutoMatchOptions {
  /** Ignora a janela de data e casa somente pelo valor. */
  soValor?: boolean;
  /** Janela permitida em dias (default 3). */
  janelaDias?: number;
  /** Tolerância de valor em reais (default 0,02). */
  toleranciaValor?: number;
  /** IDs de lançamentos que devem ser considerados indisponíveis. */
  lancamentosBloqueados?: Iterable<string>;
}

export interface AutoMatchResultado {
  extratoId: string;
  lancamentoId: string;
}

/** Distância em dias entre duas datas ISO (YYYY-MM-DD). */
export function diasEntreDatas(a?: string | null, b?: string | null): number {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round((da - db) / 86400000));
}

/** Tipo esperado do lançamento dado o sinal do valor no extrato. */
export function tipoEsperadoPeloSinal(valorExtrato: number): "receber" | "pagar" {
  return valorExtrato >= 0 ? "receber" : "pagar";
}

export function autoMatchBanco(
  extratoItems: AutoMatchExtrato[],
  lancamentos: AutoMatchLancamento[],
  opts: AutoMatchOptions = {},
): AutoMatchResultado[] {
  const janela = opts.janelaDias ?? 3;
  const tolerancia = opts.toleranciaValor ?? 0.02;
  const soValor = !!opts.soValor;
  const usados = new Set<string>(opts.lancamentosBloqueados ?? []);
  const resultados: AutoMatchResultado[] = [];

  for (const extrato of extratoItems) {
    const tipoAlvo = tipoEsperadoPeloSinal(extrato.valor);
    const compat = lancamentos.filter((l) => {
      if (usados.has(l.id)) return false;
      if (l.tipo !== tipoAlvo) return false;
      const valorOk =
        Math.abs(Math.abs(Number(l.valor)) - Math.abs(extrato.valor)) < tolerancia;
      if (!valorOk) return false;
      if (soValor) return true;
      return diasEntreDatas(l.data_vencimento, extrato.data) <= janela;
    });
    if (compat.length === 0) continue;
    compat.sort(
      (a, b) =>
        diasEntreDatas(a.data_vencimento, extrato.data) -
        diasEntreDatas(b.data_vencimento, extrato.data),
    );
    if (
      compat.length > 1 &&
      diasEntreDatas(compat[0].data_vencimento, extrato.data) ===
        diasEntreDatas(compat[1].data_vencimento, extrato.data)
    ) {
      continue;
    }
    resultados.push({ extratoId: extrato.id, lancamentoId: compat[0].id });
    usados.add(compat[0].id);
  }

  return resultados;
}