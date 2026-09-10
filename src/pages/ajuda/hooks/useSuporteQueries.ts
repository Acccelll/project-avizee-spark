import { useQuery } from "@tanstack/react-query";
import {
  getChamado,
  listarAnexosChamado,
  listarEventosChamado,
  listarMeusChamados,
  obterDiagnosticoSuporte,
} from "@/services/suporte.service";

export const SUPORTE_QUERY_KEYS = {
  meusChamados: ["suporte-meus-chamados"] as const,
  chamado: (id: string) => ["suporte-chamado", id] as const,
  eventos: (id: string) => ["suporte-chamado-eventos", id] as const,
  anexos: (id: string) => ["suporte-chamado-anexos", id] as const,
  diagnostico: (id: string) => ["suporte-chamado-diagnostico", id] as const,
};

export function useMeusChamados() {
  return useQuery({
    queryKey: SUPORTE_QUERY_KEYS.meusChamados,
    queryFn: listarMeusChamados,
  });
}

export function useChamado(id: string | undefined) {
  return useQuery({
    queryKey: SUPORTE_QUERY_KEYS.chamado(id ?? ""),
    queryFn: () => getChamado(id as string),
    enabled: !!id,
  });
}

export function useEventosChamado(id: string | undefined) {
  return useQuery({
    queryKey: SUPORTE_QUERY_KEYS.eventos(id ?? ""),
    queryFn: () => listarEventosChamado(id as string),
    enabled: !!id,
  });
}

export function useAnexosChamado(id: string | undefined) {
  return useQuery({
    queryKey: SUPORTE_QUERY_KEYS.anexos(id ?? ""),
    queryFn: () => listarAnexosChamado(id as string),
    enabled: !!id,
  });
}

/** Diagnóstico técnico (spec §29) — só relevante para o painel administrativo; `enabled` também exige `podeVer`. */
export function useDiagnosticoChamado(id: string | undefined, podeVer: boolean) {
  return useQuery({
    queryKey: SUPORTE_QUERY_KEYS.diagnostico(id ?? ""),
    queryFn: () => obterDiagnosticoSuporte(id as string),
    enabled: !!id && podeVer,
  });
}
