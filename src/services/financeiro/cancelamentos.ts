/**
 * Cancelamento de lançamentos financeiros.
 *
 * Cancela um lançamento (não pago, sem baixas ativas) via RPC oficial
 * `financeiro_cancelar_lancamento`. O registro é preservado com
 * status='cancelado' para manter a trilha de auditoria.
 *
 * Extraído de `src/services/financeiro.service.ts` (Fase 5 — limpeza estrutural).
 */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { notifyError } from "@/utils/errorMessages";
import { logger } from "@/lib/logger";

export async function cancelarLancamento(
  lancamentoId: string,
  motivo: string,
): Promise<boolean> {
  try {
    if (!motivo || motivo.trim().length < 5) {
      toast.error("Informe um motivo para o cancelamento (mínimo 5 caracteres).");
      return false;
    }
    const { error } = await supabase.rpc("financeiro_cancelar_lancamento", {
      p_id: lancamentoId,
      p_motivo: motivo.trim(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    if (error) throw error;
    toast.success("Lançamento cancelado com sucesso.");
    return true;
  } catch (error) {
    logger.error("[financeiro] erro ao cancelar:", error);
    notifyError(error);
    return false;
  }
}