/**
 * Sprint 4 — Serviço de trilha de auditoria da Conciliação Bancária.
 * Grava, de forma append-only, cada ação relevante na tabela
 * `financeiro_conciliacao_auditoria`. Falhas são apenas logadas
 * (nunca bloqueiam o fluxo de negócio).
 */
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export type AcaoAuditoria =
  | "importacao"
  | "conciliacao"
  | "estorno"
  | "ajuste"
  | "exclusao"
  | "sugestao_aceita"
  | "sugestao_rejeitada";

export async function registrarAuditoriaConciliacao(input: {
  empresaId: string;
  usuarioId: string | null;
  acao: AcaoAuditoria;
  entidade: string;
  entidadeId?: string | null;
  payload?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    const row = {
      empresa_id: input.empresaId,
      usuario_id: input.usuarioId ?? undefined,
      acao: input.acao,
      entidade: input.entidade,
      entidade_id: input.entidadeId ?? undefined,
      payload: (input.payload ?? undefined) as never,
    };
    const { error } = await supabase
      .from("financeiro_conciliacao_auditoria")
      .insert([row]);
    if (error) throw new Error(error.message);
  } catch (err) {
    logger.warn("[conciliacao/auditoria] falha ao registrar evento:", err);
  }
}