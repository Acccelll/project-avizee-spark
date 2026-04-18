import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MetaConfig {
  receber?: number;
  pagar?: number;
  saldo?: number;
  faturamento?: number;
  [key: string]: number | undefined;
}

const METAS_CHAVE = 'dashboard_metas';
const QUERY_KEY = ['admin', 'dashboard-metas'] as const;

async function fetchMetas(): Promise<MetaConfig> {
  const { data, error } = await supabase
    .from('app_configuracoes')
    .select('valor')
    .eq('chave', METAS_CHAVE)
    .maybeSingle();

  if (error) throw error;
  if (!data?.valor) return {};
  return data.valor as MetaConfig;
}

async function saveMetas(metas: MetaConfig): Promise<void> {
  const { error } = await supabase
    .from('app_configuracoes')
    .upsert(
      { chave: METAS_CHAVE, valor: metas as unknown as Record<string, unknown>, updated_at: new Date().toISOString() },
      { onConflict: 'chave' },
    );
  if (error) throw error;
}

export function useMetas() {
  const queryClient = useQueryClient();

  const query = useQuery<MetaConfig, Error>({
    queryKey: QUERY_KEY,
    queryFn: fetchMetas,
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation<void, Error, MetaConfig>({
    mutationFn: saveMetas,
    onSuccess: (_data, variables) => {
      queryClient.setQueryData(QUERY_KEY, variables);
    },
  });

  const updateMeta = useCallback(
    (key: string, value: number | undefined) => {
      const current = query.data ?? {};
      mutation.mutate({ ...current, [key]: value });
    },
    [query.data, mutation],
  );

  return {
    metas: query.data ?? {},
    loading: query.isLoading,
    updateMeta,
    saveMetas: mutation.mutate,
  };
}
