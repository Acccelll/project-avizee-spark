/**
 * Toggle de densidade compacta para os cards e tabelas de Relatórios.
 *
 * Persistência atual: localStorage (chave `relatorios:density`).
 * Roadmap: migrar para `user_preferences` quando a tabela for ativada nesse
 * módulo (ver `mem://features/preferencias-de-usuario`).
 *
 * Extraído de `Relatorios.tsx` (Fase 5 do roadmap).
 */

import { useEffect, useState } from 'react';

const DENSITY_KEY = 'relatorios:density';

export function useRelatorioDensity() {
  const [compactDensity, setCompactDensity] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(DENSITY_KEY) === '1';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(DENSITY_KEY, compactDensity ? '1' : '0');
    }
  }, [compactDensity]);

  return { compactDensity, setCompactDensity };
}