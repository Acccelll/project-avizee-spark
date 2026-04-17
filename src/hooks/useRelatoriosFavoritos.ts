/**
 * useRelatoriosFavoritos — persists report filter configurations in localStorage.
 *
 * Each favourite stores the full URL search-params string so that
 * restoring a favourite simply requires calling setSearchParams with the
 * stored value (parsed back into a URLSearchParams object).
 *
 * Guards:
 *   - Favourites must have a valid `tipo` param to be saved or loaded.
 *   - Duplicate names are rejected (case-insensitive).
 *   - Invalid entries are silently discarded on load.
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

function isValidFavorito(f: unknown): f is RelatorioFavorito {
  if (!f || typeof f !== "object") return false;
  const fav = f as Record<string, unknown>;
  if (!fav.id || !fav.nome || !fav.params || !fav.criadoEm) return false;
  // Must contain a valid tipo param
  return !!new URLSearchParams(String(fav.params)).get("tipo");
}

function loadFavoritos(): RelatorioFavorito[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    return Array.isArray(parsed) ? parsed.filter(isValidFavorito) : [];
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

  /**
   * Saves the current filter configuration as a named favourite.
   * Returns the created item, or null when:
   *   - nome is empty
   *   - searchParams has no `tipo`
   *   - a favourite with the same name already exists
   */
  const salvar = useCallback((nome: string, searchParams: URLSearchParams): RelatorioFavorito | null => {
    const nomeClean = nome.trim();
    if (!nomeClean) return null;
    if (!searchParams.get("tipo")) return null;

    let result: RelatorioFavorito | null = null;

    setFavoritos((prev) => {
      // Reject duplicate names (case-insensitive)
      if (prev.some((f) => f.nome.toLowerCase() === nomeClean.toLowerCase())) {
        return prev;
      }
      const novo: RelatorioFavorito = {
        id: crypto.randomUUID(),
        nome: nomeClean,
        params: searchParams.toString(),
        criadoEm: new Date().toISOString(),
      };
      result = novo;
      const updated = [...prev, novo];
      saveFavoritos(updated);
      return updated;
    });

    return result;
  }, []);

  const remover = useCallback((id: string) => {
    setFavoritos((prev) => {
      const updated = prev.filter((f) => f.id !== id);
      saveFavoritos(updated);
      return updated;
    });
  }, []);

  const renomear = useCallback((id: string, novoNome: string) => {
    const nomeClean = novoNome.trim();
    if (!nomeClean) return;
    setFavoritos((prev) => {
      const updated = prev.map((f) =>
        f.id === id ? { ...f, nome: nomeClean } : f
      );
      saveFavoritos(updated);
      return updated;
    });
  }, []);

  return { favoritos, salvar, remover, renomear };
}
