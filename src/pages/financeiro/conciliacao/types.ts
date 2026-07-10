import type { Lancamento } from "@/types/domain";

export interface LancamentoComStatus extends Lancamento {
  statusConciliacao: string;
  extratoId: string | null;
  divergencia: number | null;
}

export interface Match {
  extratoId: string;
  lancamentoId: string;
  origem?: "heuristica" | "ia" | "inline" | "manual" | "sugestao";
  justificativa?: string;
  sugestaoScore?: number | null;
  sugestaoMotivos?: string[] | null;
}

export interface SugestaoPersistida {
  extratoPersistidoId: string;
  lancamentoId: string;
  score: number;
  motivos: string[] | null;
}