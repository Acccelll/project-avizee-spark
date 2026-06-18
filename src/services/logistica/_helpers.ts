/**
 * Helpers puros (sem I/O) extraídos dos services de logística para
 * permitir cobertura de teste sem mocks de Supabase.
 *
 * Regra: este arquivo NUNCA importa `supabase`, `fetch`, `react-query`
 * ou qualquer dependência com efeito colateral. Apenas tipos + lógica.
 */

import type { RemessaTransition } from "./remessas.service";

/** Status de remessa cuja transição é executada via RPC (com side-effect de estoque). */
const TRANSICOES_COM_RPC: ReadonlySet<RemessaTransition> = new Set([
  "em_transito",
  "entregue",
  "cancelado",
]);

/** Indica se a transição precisa rodar via RPC (com side-effect de estoque). */
export function isTransicaoComRpc(novoStatus: RemessaTransition): boolean {
  return TRANSICOES_COM_RPC.has(novoStatus);
}

/** Chave de deduplicação canônica de um evento de tracking. */
export function eventoKey(e: {
  descricao: string;
  local: string | null;
  data_hora: string;
}): string {
  return `${e.data_hora}::${e.descricao}::${e.local ?? ""}`;
}

/**
 * Filtra eventos ainda não persistidos, deduplicando por
 * (data_hora, descricao, local). Mantém a ordem de `novos`.
 */
export function filtrarEventosNovos<
  T extends { descricao: string; local: string | null; data_hora: string },
>(novos: T[], existentes: ReadonlyArray<{ descricao: string; local: string | null; data_hora: string }>): T[] {
  const set = new Set(existentes.map(eventoKey));
  return novos.filter((e) => !set.has(eventoKey(e)));
}

/**
 * Dada uma lista já ordenada do mais recente para o mais antigo,
 * retorna o primeiro registro encontrado por `remessa_id`.
 * Usado para resolver "última etiqueta por remessa".
 */
export function latestPorRemessa<T extends { remessa_id: string }>(
  rowsDescByCreated: ReadonlyArray<T>,
): Record<string, T> {
  const map: Record<string, T> = {};
  for (const row of rowsDescByCreated) {
    if (!map[row.remessa_id]) map[row.remessa_id] = row;
  }
  return map;
}

/** Converte string base64 em Blob (jsdom-safe, sem Buffer). */
export function base64ToBlob(b64: string, mime = "application/pdf"): Blob {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}