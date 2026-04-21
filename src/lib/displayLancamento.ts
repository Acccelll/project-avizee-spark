/**
 * Helpers de exibição para lançamentos financeiros.
 *
 * Bug histórico: alguns registros foram gravados com `descricao = "[object Object]"`
 * (resultado de `String(objetoPlanoContas)`). O backfill SQL corrige a base, mas
 * mantemos esta camada de defesa em cascata para o eventual reincidência ou
 * payloads em memória.
 */

interface LancamentoLike {
  descricao?: unknown;
  contas_contabeis?: { descricao?: string | null } | null;
}

export function displayDescricao(l: LancamentoLike): string {
  const raw = l.descricao;
  if (raw && typeof raw === 'object') {
    const planoNome = l.contas_contabeis?.descricao;
    return planoNome || 'Lançamento sem descrição';
  }
  if (typeof raw === 'string') {
    if (raw === '[object Object]' || raw.trim() === '') {
      return l.contas_contabeis?.descricao || 'Lançamento sem descrição';
    }
    return raw;
  }
  return l.contas_contabeis?.descricao || 'Lançamento sem descrição';
}