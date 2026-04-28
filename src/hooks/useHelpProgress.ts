import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Acesso ao registro `help_progress` do usuário corrente. Mantém o estado em
 * memória + sincronização leve com o banco. RLS garante que cada usuário só
 * lê/escreve a sua linha.
 */
export interface HelpProgressState {
  seenTours: string[]; // formato `route@version`
  disabledFirstVisit: boolean;
}

const EMPTY: HelpProgressState = { seenTours: [], disabledFirstVisit: false };

export function useHelpProgress() {
  const { user } = useAuth();
  const [state, setState] = useState<HelpProgressState>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    if (!user?.id) {
      setState(EMPTY);
      setLoaded(true);
      return;
    }
    const { data } = await supabase
      .from('help_progress')
      .select('seen_tours, disabled_first_visit')
      .eq('user_id', user.id)
      .maybeSingle();
    setState({
      seenTours: data?.seen_tours ?? [],
      disabledFirstVisit: !!data?.disabled_first_visit,
    });
    setLoaded(true);
  }, [user?.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const persist = useCallback(
    async (next: HelpProgressState) => {
      if (!user?.id) return;
      setState(next);
      const { error } = await supabase
        .from('help_progress')
        .upsert({
          user_id: user.id,
          seen_tours: next.seenTours,
          disabled_first_visit: next.disabledFirstVisit,
        });
      if (error) {
        // silencioso: não atrapalha a UX, apenas registra para debug
        console.warn('[help_progress] upsert falhou', error);
      }
    },
    [user?.id],
  );

  const markSeen = useCallback(
    (route: string, version: number) => {
      const tag = `${route}@${version}`;
      if (state.seenTours.includes(tag)) return;
      void persist({ ...state, seenTours: [...state.seenTours, tag] });
    },
    [state, persist],
  );

  const setDisabledFirstVisit = useCallback(
    (disabled: boolean) => {
      void persist({ ...state, disabledFirstVisit: disabled });
    },
    [state, persist],
  );

  const resetAll = useCallback(() => {
    void persist({ seenTours: [], disabledFirstVisit: false });
  }, [persist]);

  const hasSeen = useCallback(
    (route: string, version: number) => state.seenTours.includes(`${route}@${version}`),
    [state.seenTours],
  );

  return { state, loaded, markSeen, setDisabledFirstVisit, resetAll, hasSeen, reload };
}