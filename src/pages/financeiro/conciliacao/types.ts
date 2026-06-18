import type { Lancamento } from "@/types/domain";

export interface LancamentoComStatus extends Lancamento {
  statusConciliacao: string;
  extratoId: string | null;
  divergencia: number | null;
}

export interface Match {
  extratoId: string;
  lancamentoId: string;
  origem?: "heuristica" | "ia";
  justificativa?: string;
}