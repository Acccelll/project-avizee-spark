import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserPreference } from '@/hooks/useUserPreference';
import { useAuth } from './AuthContext';

/**
 * AppConfigContext
 *
 * Contexto centralizado que expõe as configurações mais utilizadas pelo sistema:
 * - `cepEmpresa`: CEP da empresa (lido de empresa_config), fonte para cotação de frete.
 * - `sidebarCollapsed`: preferência de layout do menu lateral do usuário atual.
 *
 * ESCOPO INTENCIONAL: Este contexto expõe apenas os valores de configuração que
 * são lidos de forma transversal por múltiplos módulos.  Ele NÃO gerencia:
 * - preferências de aparência (tema, densidade, fonte) — gerenciadas localmente
 *   em Configuracoes.tsx via `useUserPreference`;
 * - configurações globais do sistema (nome, email, integrações) — gerenciadas
 *   pelo módulo administrativo em `src/pages/configuracoes/*`;
 * - cores globais da interface — lidas e aplicadas diretamente pelo ThemeProvider.
 */

interface AppConfigContextValue {
  // ── Configurações de empresa ───────────────────────────────────────────────
  /** CEP da empresa (usado em cotações de frete). Lido de empresa_config.cep. */
  cepEmpresa: string | null;
  /** `true` enquanto o valor está sendo carregado do Supabase. */
  loadingCepEmpresa: boolean;

  // ── Preferências do usuário ────────────────────────────────────────────────
  /** Estado de colapso do menu lateral. */
  sidebarCollapsed: boolean;
  /** `true` enquanto a preferência está sendo carregada do Supabase. */
  loadingSidebarCollapsed: boolean;
  /** Persiste a nova preferência no Supabase e atualiza o cache cross-tab. */
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

/**
 * Retorna o valor do `AppConfigContext`.
 * Lança um erro se usado fora de `AppConfigProvider`.
 */
export function useAppConfigContext(): AppConfigContextValue {
  const ctx = useContext(AppConfigContext);
  if (!ctx) {
    throw new Error('useAppConfigContext deve ser usado dentro de <AppConfigProvider>');
  }
  return ctx;
}
