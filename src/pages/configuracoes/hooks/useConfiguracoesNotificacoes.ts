import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { fetchConfig, updateConfig } from '../services/configuracoes.service';
import { mergeConfiguracoes, type ConfigNotificacoes } from '@/utils/configuracoes';
import { getUserFriendlyError } from '@/utils/errorMessages';
import { logger } from '@/utils/logger';

const defaultNotificacoes: ConfigNotificacoes = {
  email_novo_pedido: true,
  email_pagamento_recebido: true,
  email_estoque_baixo: true,
  push_ativo: false,
  frequencia_resumo: 'diario',
};

const QUERY_KEY = ['configuracoes', 'notificacoes'] as const;

export function useConfiguracoesNotificacoes() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useQuery<ConfigNotificacoes, Error>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const saved = await fetchConfig<Partial<ConfigNotificacoes>>('notificacoes');
      return mergeConfiguracoes(defaultNotificacoes, saved);
    },
    staleTime: Infinity,
  });

  const mutation = useMutation({
    mutationFn: (data: ConfigNotificacoes) =>
      updateConfig('notificacoes', data as unknown as Record<string, unknown>, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Configurações de notificações salvas com sucesso.');
    },
    onError: (err: Error) => {
      logger.error('[configuracoes] Erro ao salvar config notificacoes:', err);
      toast.error(getUserFriendlyError(err));
    },
  });

  return {
    config: query.data ?? defaultNotificacoes,
    isLoading: query.isLoading,
    isError: query.isError,
    handleSave: mutation.mutate,
    isSaving: mutation.isPending,
  };
}
