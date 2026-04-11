import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { fetchConfig, updateConfig } from '../services/configuracoes.service';
import { mergeConfiguracoes, type ConfigGeral } from '@/utils/configuracoes';

const defaultGeral: ConfigGeral = {
  nome_sistema: 'Avizee Spark',
  moeda: 'BRL',
  fuso_horario: 'America/Sao_Paulo',
  formato_data: 'DD/MM/YYYY',
  idioma: 'pt-BR',
  manutencao_modo: false,
};

const QUERY_KEY = ['configuracoes', 'geral'] as const;

export function useConfiguracoesGeral() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useQuery<ConfigGeral, Error>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const saved = await fetchConfig<Partial<ConfigGeral>>('geral');
      return mergeConfiguracoes(defaultGeral, saved);
    },
    staleTime: Infinity,
  });

  const mutation = useMutation({
    mutationFn: (data: ConfigGeral) =>
      updateConfig('geral', data as unknown as Record<string, unknown>, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Configurações gerais salvas com sucesso.');
    },
    onError: (err: Error) => {
      console.error('[configuracoes] Erro ao salvar config geral:', err);
      toast.error('Erro ao salvar configurações. Tente novamente.');
    },
  });

  return {
    config: query.data ?? defaultGeral,
    isLoading: query.isLoading,
    isError: query.isError,
    handleSave: mutation.mutate,
    isSaving: mutation.isPending,
  };
}
