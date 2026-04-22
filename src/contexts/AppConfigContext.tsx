import { createContext, useContext, ReactNode } from 'react';
import { useUserPreference } from '@/hooks/useUserPreference';
import { useBrandingPreview } from '@/hooks/useBrandingPreview';
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

  /**
   * Modo do menu lateral:
   *  - `fixed-expanded`: sempre expandido (240px)
   *  - `fixed-collapsed`: sempre recolhido (72px)
   *  - `dynamic`: recolhido por padrão; expande no hover (overlay)
   */
  sidebarMode: SidebarMode;
  saveSidebarMode: (mode: SidebarMode) => Promise<boolean>;

  /** Branding institucional (carregado de empresa_config). */
  branding: {
    logoUrl: string | null;
    simboloUrl: string | null;
    marcaTexto: string | null;
    marcaSubtitulo: string | null;
  };
}

export type SidebarMode = 'fixed-expanded' | 'fixed-collapsed' | 'dynamic';

const AppConfigContext = createContext<AppConfigContextValue | null>(null);

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // Branding e CEP da empresa vêm de uma única query cacheada (`useBrandingPreview`)
  // — eliminando as 3-4 leituras concorrentes que existiam no boot.
  const { branding: brandingPreview, loading: loadingBranding } = useBrandingPreview();
  const cepEmpresa = brandingPreview.cep;
  const loadingCepEmpresa = loadingBranding;
  const branding = {
    logoUrl: brandingPreview.logoUrl,
    simboloUrl: brandingPreview.simboloUrl,
    marcaTexto: brandingPreview.marcaTexto || null,
    marcaSubtitulo: brandingPreview.marcaSubtitulo,
  };

  const {
    value: sidebarCollapsed,
    loading: loadingSidebarCollapsed,
    save: saveSidebarCollapsed,
  } = useUserPreference<boolean>(user?.id, 'sidebar_collapsed', true);

  const {
    value: sidebarMode,
    save: saveSidebarMode,
  } = useUserPreference<SidebarMode>(user?.id, 'sidebar_mode', 'dynamic');

  return (
    <AppConfigContext.Provider
      value={{
        cepEmpresa,
        loadingCepEmpresa,
        sidebarCollapsed,
        loadingSidebarCollapsed,
        saveSidebarCollapsed,
        sidebarMode,
        saveSidebarMode,
        branding,
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
