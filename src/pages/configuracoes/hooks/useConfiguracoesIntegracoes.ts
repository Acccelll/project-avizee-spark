/**
 * useConfiguracoesIntegracoes
 *
 * Hook para as configurações de integrações (gateway, SEFAZ, webhooks)
 * **globais** do sistema.  Requer permissão de administrador.  Faz parte do
 * módulo administrativo em `src/pages/configuracoes/*`.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { fetchConfig, updateConfig } from '../services/configuracoes.service';
import { mergeConfiguracoes, type ConfigIntegracao } from '@/utils/configuracoes';
import { getUserFriendlyError } from '@/utils/errorMessages';

const defaultIntegracao: ConfigIntegracao = {
  gateway_pagamento: '',
  gateway_api_key: '',
  gateway_secret_key: '',
  sefaz_ambiente: 'homologacao',
  sefaz_certificado: '',
  sefaz_senha_certificado: '',
  webhook_url: '',
  api_endpoint: '',
};

const QUERY_KEY = ['configuracoes', 'integracoes'] as const;

export function useConfiguracoesIntegracoes() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useQuery<ConfigIntegracao, Error>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const saved = await fetchConfig<Partial<ConfigIntegracao>>('integracoes');
      return mergeConfiguracoes(defaultIntegracao, saved);
    },
    staleTime: Infinity,
  });

  const mutation = useMutation({
    mutationFn: (data: ConfigIntegracao) =>
      updateConfig('integracoes', data as unknown as Record<string, unknown>, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Configurações de integrações salvas com sucesso.');
    },
    onError: (err: Error) => {
      console.error('[configuracoes] Erro ao salvar config integracoes:', err);
      toast.error(getUserFriendlyError(err));
    },
  });

  return {
    config: query.data ?? defaultIntegracao,
    isLoading: query.isLoading,
    isError: query.isError,
    handleSave: mutation.mutate,
    isSaving: mutation.isPending,
  };
}
