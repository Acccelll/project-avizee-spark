import { useQuery } from "@tanstack/react-query";
import {
  getChamado,
  listarAnexosChamado,
  listarEventosChamado,
  listarMeusChamados,
} from "@/services/suporte.service";

export const SUPORTE_QUERY_KEYS = {
  meusChamados: ["suporte-meus-chamados"] as const,
  chamado: (id: string) => ["suporte-chamado", id] as const,
  eventos: (id: string) => ["suporte-chamado-eventos", id] as const,
  anexos: (id: string) => ["suporte-chamado-anexos", id] as const,
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
