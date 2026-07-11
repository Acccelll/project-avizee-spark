/**
 * Sprint 3 — Carrega tolerâncias configuradas por empresa para a
 * conciliação bancária. Fallback: 3 dias / 10 centavos.
 */
import { supabase } from "@/integrations/supabase/client";

export interface TolerianciasConciliacao {
  dias: number;
  valor_centavos: number;
}

export const TOLERANCIA_DEFAULT: TolerianciasConciliacao = {
  dias: 3,
  valor_centavos: 10,
};

export async function carregarToleranciasConciliacao(
  empresaId: string,
): Promise<TolerianciasConciliacao> {
  try {
    const { data } = await supabase
      .from("empresa_config")
      .select("conciliacao_tolerancias")
      .eq("id", empresaId)
      .maybeSingle();
    const raw = (data as { conciliacao_tolerancias?: Partial<TolerianciasConciliacao> } | null)
      ?.conciliacao_tolerancias;
    if (!raw) return TOLERANCIA_DEFAULT;
    return {
      dias: Number(raw.dias ?? TOLERANCIA_DEFAULT.dias),
      valor_centavos: Number(raw.valor_centavos ?? TOLERANCIA_DEFAULT.valor_centavos),
    };
  } catch {
    return TOLERANCIA_DEFAULT;
  }
}