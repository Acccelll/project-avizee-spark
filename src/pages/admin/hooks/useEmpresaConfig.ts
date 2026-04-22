/**
 * Hook de configuração da empresa — encapsula React Query para carregar
 * e salvar `empresa_config` e `app_configuracoes`.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/errorMessages";
import {
  fetchEmpresaConfig,
  fetchAppConfig,
  saveEmpresaConfig,
  saveAppConfig,
  type AppConfigChave,
  type EmpresaConfig,
  type EmpresaConfigUpdate,
} from "@/services/admin/empresa.service";
import { BRANDING_QUERY_KEY } from "@/hooks/useBrandingPreview";

const EMPRESA_KEY = ["admin", "empresa-config"] as const;
const appConfigKey = (chave: AppConfigChave) =>
  ["admin", "app-config", chave] as const;

export function useEmpresaConfig() {
  const queryClient = useQueryClient();

  const query = useQuery<EmpresaConfig | null, Error>({
    queryKey: EMPRESA_KEY,
    queryFn: fetchEmpresaConfig,
    staleTime: 5 * 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: (config: EmpresaConfigUpdate & { id?: string }) =>
      saveEmpresaConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EMPRESA_KEY });
      // Mantém branding global (logo/cores) consumido por toda a app
      // sincronizado após edições do administrador.
      queryClient.invalidateQueries({ queryKey: BRANDING_QUERY_KEY });
      toast.success("Configurações da empresa salvas com sucesso.");
    },
    onError: (err: Error) => {
      console.error("[admin] Erro ao salvar empresa_config:", err);
      toast.error(getUserFriendlyError(err));
    },
  });

  return {
    empresaConfig: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    handleSave: saveMutation.mutate,
    isSaving: saveMutation.isPending,
  };
}

export function useAppConfig(chave: AppConfigChave) {
  const queryClient = useQueryClient();
  const key = appConfigKey(chave);

  const query = useQuery<Record<string, unknown>, Error>({
    queryKey: key,
    queryFn: () => fetchAppConfig(chave),
    staleTime: 5 * 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: (valor: Record<string, unknown>) => saveAppConfig(chave, valor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      toast.success("Configurações salvas com sucesso.");
    },
    onError: (err: Error) => {
      console.error(`[admin] Erro ao salvar config '${chave}':`, err);
      toast.error(getUserFriendlyError(err));
    },
  });

  return {
    config: query.data ?? {},
    isLoading: query.isLoading,
    handleSave: saveMutation.mutate,
    isSaving: saveMutation.isPending,
  };
}
