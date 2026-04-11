// @ts-nocheck
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { fetchConfig, updateConfig } from '../services/configuracoes.service';
import { mergeConfiguracoes, type ConfigEmail } from '@/utils/configuracoes';

const defaultEmail: ConfigEmail = {
  smtp_host: '',
  smtp_porta: 587,
  smtp_usuario: '',
  smtp_senha: '',
  smtp_ssl: true,
  remetente_nome: '',
  remetente_email: '',
};

const QUERY_KEY = ['configuracoes', 'email'] as const;

export function useConfiguracoesEmail() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useQuery<ConfigEmail, Error>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const saved = await fetchConfig<Partial<ConfigEmail>>('email');
      return mergeConfiguracoes(defaultEmail, saved);
    },
    staleTime: Infinity,
  });

  const mutation = useMutation({
    mutationFn: (data: ConfigEmail) =>
      updateConfig('email', data as unknown as Record<string, unknown>, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Configurações de e-mail salvas com sucesso.');
    },
    onError: (err: Error) => {
      console.error('[configuracoes] Erro ao salvar config email:', err);
      toast.error('Erro ao salvar configurações. Tente novamente.');
    },
  });

  return {
    config: query.data ?? defaultEmail,
    isLoading: query.isLoading,
    isError: query.isError,
    handleSave: mutation.mutate,
    isSaving: mutation.isPending,
  };
}
