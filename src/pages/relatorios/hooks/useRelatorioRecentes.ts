import { useCallback, useState } from 'react';

const STORAGE_KEY = 'relatorio-recentes';
const MAX_RECENTES = 4;

export interface RelatorioRecente {
  tipo: string;
  acessadoEm: number;
}

export function useRelatorioRecentes() {
  const [recentes, setRecentes] = useState<RelatorioRecente[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENTES) : [];
    } catch {
      return [];
    }
  });

  const registrar = useCallback((tipo: string) => {
    setRecentes((prev) => {
      const filtered = prev.filter((r) => r.tipo !== tipo);
      const next = [{ tipo, acessadoEm: Date.now() }, ...filtered].slice(0, MAX_RECENTES);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* noop */
      }
      return next;
    });
  }, []);

  return { recentes, registrar };
}

export function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}m atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ontem';
  if (d < 7) return `${d}d atrás`;
  if (d < 30) return `${Math.floor(d / 7)}sem atrás`;
  return `${Math.floor(d / 30)}m atrás`;
}