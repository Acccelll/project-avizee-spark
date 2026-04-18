import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserPreference } from '@/hooks/useUserPreference';
import { useAuth } from './AuthContext';

/**
 * AppConfigContext
 *
 * Contexto centralizado para configurações lidas de forma transversal:
 *  - `cepEmpresa`: CEP da empresa (cotação de frete);
 *  - `sidebarCollapsed`: preferência de layout do menu lateral.
 *
 * Tudo que é "configuração compartilhada por múltiplos módulos" entra aqui;
 * preferências locais de tela continuam em `useUserPreference` direto nas
 * próprias telas.
 */

interface AppConfigContextValue {
  cepEmpresa: string | null;
  loadingCepEmpresa: boolean;

  sidebarCollapsed: boolean;
  loadingSidebarCollapsed: boolean;
  saveSidebarCollapsed: (value: boolean) => Promise<boolean>;
}

const AppConfigContext = createContext<AppConfigContextValue | null>(null);

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [cepEmpresa, setCepEmpresa] = useState<string | null>(null);
  const [loadingCepEmpresa, setLoadingCepEmpresa] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoadingCepEmpresa(false); return; }
    supabase.from('empresa_config').select('cep').maybeSingle().then(({ data, error }) => {
      if (!error) setCepEmpresa(data?.cep ? data.cep.replace(/\D/g, '') : null);
      setLoadingCepEmpresa(false);
    });
  }, []);

  const {
    value: sidebarCollapsed,
    loading: loadingSidebarCollapsed,
    save: saveSidebarCollapsed,
  } = useUserPreference<boolean>(user?.id, 'sidebar_collapsed', true);

  return (
    <AppConfigContext.Provider
      value={{
        cepEmpresa,
        loadingCepEmpresa,
        sidebarCollapsed,
        loadingSidebarCollapsed,
        saveSidebarCollapsed,
      }}
    >
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppConfigContext(): AppConfigContextValue {
  const ctx = useContext(AppConfigContext);
  if (!ctx) {
    throw new Error('useAppConfigContext deve ser usado dentro de <AppConfigProvider>');
  }
  return ctx;
}
