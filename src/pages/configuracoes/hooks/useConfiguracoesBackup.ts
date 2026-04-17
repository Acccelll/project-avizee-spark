/**
 * useConfiguracoesBackup
 *
 * Hook para as configurações de backup **globais** do sistema.
 * Requer permissão de administrador.  Faz parte do módulo administrativo
 * em `src/pages/configuracoes/*`.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { fetchConfig, updateConfig } from '../services/configuracoes.service';
import { mergeConfiguracoes, type ConfigBackup } from '@/utils/configuracoes';
import { getUserFriendlyError } from '@/utils/errorMessages';

const defaultBackup: ConfigBackup = {
  frequencia: 'diario',
  horario: '02:00',
  retencao_dias: 30,
  incluir_arquivos: false,
  destino: 'cloud',
};

const QUERY_KEY = ['configuracoes', 'backup'] as const;

export function useConfiguracoesBackup() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useQuery<ConfigBackup, Error>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const saved = await fetchConfig<Partial<ConfigBackup>>('backup');
      return mergeConfiguracoes(defaultBackup, saved);
    },
    staleTime: Infinity,
  });

  const mutation = useMutation({
    mutationFn: (data: ConfigBackup) =>
      updateConfig('backup', data as unknown as Record<string, unknown>, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Configurações de backup salvas com sucesso.');
    },
    onError: (err: Error) => {
      console.error('[configuracoes] Erro ao salvar config backup:', err);
      toast.error(getUserFriendlyError(err));
    },
  });

  return {
    config: query.data ?? defaultBackup,
    isLoading: query.isLoading,
    isError: query.isError,
    handleSave: mutation.mutate,
    isSaving: mutation.isPending,
  };
}
