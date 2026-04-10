import { createContext, useContext, ReactNode } from 'react';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useUserPreference } from '@/hooks/useUserPreference';
import { useAuth } from './AuthContext';

/**
 * AppConfigContext
 *
 * Contexto centralizado que expõe as configurações mais utilizadas pelo sistema:
 * - `cepEmpresa`: CEP da empresa, fonte para cotação de frete.
 * - `sidebarCollapsed`: preferência de layout do menu lateral do usuário atual.
 *
 * Ambas as entradas são gerenciadas por `useSyncedStorage` internamente, o que
 * garante que alterações feitas em uma aba do navegador se propagam
 * automaticamente para todas as outras abas abertas (via evento `storage`).
 *
 * Não é necessário que todos os consumidores usem este contexto — os hooks
 * `useAppConfig` e `useUserPreference` podem ser chamados diretamente quando
 * apenas uma configuração isolada for necessária. Este contexto é útil quando
 * múltiplas configurações precisam ser acessadas em conjunto, por exemplo no
 * layout principal ou na página de configurações.
 *
 * Uso:
 * ```tsx
 * const { cepEmpresa, saveCepEmpresa, sidebarCollapsed, saveSidebarCollapsed } =
 *   useAppConfigContext();
 * ```
 */

interface AppConfigContextValue {
  // ── Configurações de empresa ───────────────────────────────────────────────
  /** CEP da empresa (usado em cotações de frete). */
  cepEmpresa: string | null;
  /** `true` enquanto o valor está sendo carregado do Supabase. */
  loadingCepEmpresa: boolean;
  /** Persiste um novo CEP no Supabase e atualiza o cache cross-tab. */
  saveCepEmpresa: (value: string) => Promise<boolean>;

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

  const {
    value: cepEmpresa,
    loading: loadingCepEmpresa,
    save: saveCepEmpresa,
  } = useAppConfig<string>('cep_empresa', '');

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
        saveCepEmpresa,
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
