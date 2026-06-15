/**
 * Serviço cliente da edge function `ia-sugestao` (categorizar, conciliar,
 * explicar anomalia).
 */
import { supabase } from "@/integrations/supabase/client";

export interface SugestaoClassificacao {
  conta_contabil_id: string | null;
  centro_custo_id: string | null;
  justificativa: string;
  confianca: "alta" | "media" | "baixa";
}

export interface SugestaoConciliacaoIa {
  lancamento_id: string | null;
  justificativa: string;
  confianca: "alta" | "media" | "baixa";
}

async function invokeIaSugestao<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("ia-sugestao", { body });
  if (error) {
    let msg = error.message ?? "Falha na IA.";
    try {
      const ctx = (error as { context?: { body?: string } }).context;
      if (ctx?.body) {
        const parsed = JSON.parse(ctx.body) as { erro?: string };
        if (parsed?.erro) msg = parsed.erro;
      }
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const payload = data as { sucesso?: boolean; erro?: string } & Record<string, unknown>;
  if (!payload?.sucesso) throw new Error(payload?.erro ?? "Resposta inválida da IA.");
  return payload as unknown as T;
}

export async function sugerirClassificacao(input: {
  descricao: string;
  valor: number;
  fornecedor_nome?: string | null;
  tipo?: "pagar" | "receber";
}): Promise<SugestaoClassificacao> {
  return invokeIaSugestao<SugestaoClassificacao>({ acao: "categorizar", ...input });
}

export async function sugerirConciliacaoIaRemota(input: {
  transacao: { id: string; descricao: string; valor: number; data: string };
  candidatos: Array<{
    id: string;
    descricao: string | null;
    valor: number;
    data_vencimento: string;
    data_baixa?: string | null;
  }>;
}): Promise<SugestaoConciliacaoIa> {
  return invokeIaSugestao<SugestaoConciliacaoIa>({ acao: "conciliar", ...input });
}

export async function explicarAnomalia(input: {
  tipo_anomalia: "divergencia_preco" | "nf_duplicada" | "gasto_fora_padrao" | "duplicidade";
  dados: Record<string, unknown>;
}): Promise<{ explicacao: string }> {
  return invokeIaSugestao<{ explicacao: string }>({ acao: "explicar_anomalia", ...input });
}