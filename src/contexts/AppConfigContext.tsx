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

  const [cepEmpresa, setCepEmpresa] = useState<string | null>(null);
  const [loadingCepEmpresa, setLoadingCepEmpresa] = useState(true);
  const [branding, setBranding] = useState<AppConfigContextValue['branding']>({
    logoUrl: null, simboloUrl: null, marcaTexto: null, marcaSubtitulo: null,
  });

  useEffect(() => {
    if (!supabase) { setLoadingCepEmpresa(false); return; }
    supabase.from('empresa_config').select('cep, logo_url, simbolo_url, marca_texto, marca_subtitulo').maybeSingle().then(({ data, error }) => {
      if (!error) setCepEmpresa(data?.cep ? data.cep.replace(/\D/g, '') : null);
      if (!error && data) {
        const row = data as { logo_url?: string | null; simbolo_url?: string | null; marca_texto?: string | null; marca_subtitulo?: string | null };
        setBranding({
          logoUrl: row.logo_url ?? null,
          simboloUrl: row.simbolo_url ?? null,
          marcaTexto: row.marca_texto ?? null,
          marcaSubtitulo: row.marca_subtitulo ?? null,
        });
      }
      setLoadingCepEmpresa(false);
    });
  }, []);

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
