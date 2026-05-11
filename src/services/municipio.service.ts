import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export interface MunicipioIbge {
  codigo_ibge: string;
  nome: string;
  uf: string;
}

/**
 * Busca município no cache local (RPC `buscar_municipio_ibge`).
 * Não lança — retorna `null` em qualquer erro ou data vazio (é fallback).
 * O caller (`useMunicipioIbge`) implementa o fallback HTTP via API do IBGE.
 */
export async function buscarMunicipioIbgeDb(
  nome: string,
  uf: string,
): Promise<MunicipioIbge | null> {
  try {
    const { data, error } = await supabase.rpc("buscar_municipio_ibge", {
      p_nome: nome.trim(),
      p_uf: uf.trim().toUpperCase(),
    });
    if (error || !data || !Array.isArray(data) || data.length === 0) return null;
    return data[0] as MunicipioIbge;
  } catch (err) {
    logger.info("buscarMunicipioIbgeDb fallback", err);
    return null;
  }
}
