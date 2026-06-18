import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buscarMunicipioIbgeDb, type MunicipioIbge } from "@/services/municipio.service";
import { logger } from "@/lib/logger";

export type { MunicipioIbge };

interface IbgeApiMunicipio {
  id: number;
  nome: string;
  microrregiao: { mesorregiao: { UF: { sigla: string } } };
}

/**
 * Lookup de município (código IBGE) — obrigatório no XML da NF-e.
 *
 * Fluxo:
 * 1. Tenta resolver via RPC `buscar_municipio_ibge` (catálogo local).
 * 2. Se ausente, consulta a API pública do IBGE
 *    (`servicodados.ibge.gov.br`) e popula o cache local para a próxima vez.
 */
export function useMunicipioIbge() {
  const [loading, setLoading] = useState(false);

  const buscar = useCallback(
    async (nome: string, uf: string): Promise<MunicipioIbge | null> => {
      if (!nome?.trim() || !uf?.trim()) return null;
      setLoading(true);
      try {
        // 1) Cache local
        const cached = await buscarMunicipioIbgeDb(nome, uf);
        if (cached) return cached;

        // 2) Fallback: API pública do IBGE (uma vez por UF)
        const ufUpper = uf.trim().toUpperCase();
        const resp = await fetch(
          `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${ufUpper}/municipios`,
        );
        if (!resp.ok) return null;
        const lista = (await resp.json()) as IbgeApiMunicipio[];
        const norm = (s: string) =>
          s
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
        const alvo = norm(nome);
        const match = lista.find((m) => norm(m.nome) === alvo);
        if (!match) return null;

        const result: MunicipioIbge = {
          codigo_ibge: String(match.id),
          nome: match.nome,
          uf: ufUpper,
        };

        // Popula cache (best effort, ignora erro de RLS)
        await supabase
          .from("ibge_municipios")
          .upsert({ codigo_ibge: result.codigo_ibge, nome: result.nome, uf: result.uf })
          .then(({ error: upErr }) => {
            if (upErr) logger.info("ibge_municipios upsert skipped", upErr.message);
          });

        return result;
      } catch (err) {
        logger.error("useMunicipioIbge.buscar", err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { buscar, loading };
}