import type { SuporteChamado, SuporteStatus } from "@/services/suporte.service";

/** Colunas do quadro — fechado/cancelado ficam fora (estados terminais, sem ação de arrastar). */
export const KANBAN_COLUNAS: SuporteStatus[] = [
  "aberto",
  "em_triagem",
  "em_andamento",
  "aguardando_usuario",
  "resolvido",
];

export type AcaoDrag = "nenhuma" | "abrir_resolucao" | "mover";

/**
 * Decide o que fazer ao soltar um card numa coluna.
 *
 * Mover para "resolvido" nunca chama `suporte_triar_chamado` diretamente —
 * a tabela tem `CHECK (status <> 'resolvido' OR resumo_resolucao IS NOT NULL)`,
 * então essa transição sempre abre a triagem para capturar o resumo antes de
 * chamar `suporte_resolver_chamado`.
 */
export function decidirAcaoDrag(statusOrigem: SuporteStatus, statusDestino: SuporteStatus): AcaoDrag {
  if (statusOrigem === statusDestino) return "nenhuma";
  if (statusDestino === "resolvido") return "abrir_resolucao";
  return "mover";
}

/** Agrupa os chamados por status, garantindo uma entrada (mesmo vazia) para cada coluna do quadro. */
export function agruparPorColuna(
  chamados: SuporteChamado[],
  colunas: SuporteStatus[] = KANBAN_COLUNAS,
): Record<string, SuporteChamado[]> {
  const map: Record<string, SuporteChamado[]> = {};
  for (const status of colunas) map[status] = [];
  for (const c of chamados) {
    if (map[c.status]) map[c.status].push(c);
  }
  return map;
}
