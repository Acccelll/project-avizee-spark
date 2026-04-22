/**
 * Facade de retro-compatibilidade.
 *
 * O conteúdo deste arquivo foi reorganizado em `src/services/financeiro/*`
 * (Fase 5 — limpeza estrutural). Mantemos os mesmos símbolos exportados
 * para não quebrar imports existentes:
 *
 *   import { processarBaixaLote, processarEstorno, cancelarLancamento,
 *            getEffectiveStatus, criarPlanoBaixaLote,
 *            type BaixaItemOverride, type BaixaLoteParams }
 *     from "@/services/financeiro.service";
 *
 * Novos consumidores devem importar diretamente do barrel:
 *   import { ... } from "@/services/financeiro";
 */

export {
  processarBaixaLote,
  criarPlanoBaixaLote,
  processarEstorno,
  cancelarLancamento,
  getEffectiveStatus,
} from "@/services/financeiro";

export type {
  BaixaItemOverride,
  BaixaLoteParams,
} from "@/services/financeiro";