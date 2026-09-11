import { useEffect, useRef } from "react";

type ExportRowsLoader<T = unknown> = () => Promise<T[]>;

const loaders = new Map<string, ExportRowsLoader>();

function normalizeKey(key: string) {
  return key.trim().toLowerCase().replace(/[-_\s]/g, "");
}

/**
 * Registra uma fonte completa de exportação para listas cuja paginação é
 * controlada fora do DataTable. O registro é apenas um fallback de
 * compatibilidade; telas podem preferir a prop explícita `exportRows`.
 */
export function registerExportRowsLoader<T>(key: string, loader: ExportRowsLoader<T>) {
  const normalized = normalizeKey(key);
  loaders.set(normalized, loader as ExportRowsLoader);

  return () => {
    if (loaders.get(normalized) === loader) {
      loaders.delete(normalized);
    }
  };
}

/** Mantém o loader mais recente sem recriar o registro a cada render. */
export function useRegisterExportRowsLoader<T>(key: string, loader: ExportRowsLoader<T>) {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    const stableLoader: ExportRowsLoader<T> = () => loaderRef.current();
    return registerExportRowsLoader(key, stableLoader);
  }, [key]);
}

export function getExportRowsLoader<T>(key: string): ExportRowsLoader<T> | undefined {
  return loaders.get(normalizeKey(key)) as ExportRowsLoader<T> | undefined;
}
