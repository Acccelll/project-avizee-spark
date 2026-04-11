/**
 * useRelatoriosFavoritos — persists report filter configurations in localStorage.
 *
 * Each favourite stores the full URL search-params string so that
 * restoring a favourite simply requires calling setSearchParams with the
 * stored value (parsed back into a URLSearchParams object).
 */

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "relatorios_favoritos_v1";

export interface RelatorioFavorito {
  id: string;
  nome: string;
  /** Serialised URLSearchParams string, e.g. "tipo=vendas&di=2024-01-01" */
  params: string;
  criadoEm: string;
}

function loadFavoritos(): RelatorioFavorito[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RelatorioFavorito[]) : [];
  } catch {
    return [];
  }
}

function saveFavoritos(items: RelatorioFavorito[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function useRelatoriosFavoritos() {
  const [favoritos, setFavoritos] = useState<RelatorioFavorito[]>(loadFavoritos);

  // Keep in sync with other tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setFavoritos(loadFavoritos());
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const salvar = useCallback((nome: string, searchParams: URLSearchParams) => {
    const novo: RelatorioFavorito = {
      id: crypto.randomUUID(),
      nome: nome.trim(),
      params: searchParams.toString(),
      criadoEm: new Date().toISOString(),
    };
    setFavoritos((prev) => {
      const updated = [...prev, novo];
      saveFavoritos(updated);
      return updated;
    });
    return novo;
  }, []);

  const remover = useCallback((id: string) => {
    setFavoritos((prev) => {
      const updated = prev.filter((f) => f.id !== id);
      saveFavoritos(updated);
      return updated;
    });
  }, []);

  const renomear = useCallback((id: string, novoNome: string) => {
    setFavoritos((prev) => {
      const updated = prev.map((f) =>
        f.id === id ? { ...f, nome: novoNome.trim() } : f
      );
      saveFavoritos(updated);
      return updated;
    });
  }, []);

  return { favoritos, salvar, remover, renomear };
}
