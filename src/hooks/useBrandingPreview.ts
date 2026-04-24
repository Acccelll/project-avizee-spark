import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import fallbackLogo from '@/assets/brand-logotipo.png';
import fallbackSimbolo from '@/assets/brand-simbolo.png';

/**
 * useBrandingPreview
 *
 * Fonte única de verdade para branding institucional (`empresa_config`).
 * Substitui as leituras concorrentes que existiam em `ThemeProvider`,
 * `AppConfigContext`, `useBranding` e `Configuracoes.tsx`, evitando 3-4
 * round-trips no boot.
 *
 * Cache via React Query (`staleTime` 5 min). Quando admin altera branding em
 * `Administracao` → `Empresa`, basta invalidar a query
 * `BRANDING_QUERY_KEY` (helper exportado abaixo) para que todos os
 * consumidores se atualizem imediatamente, sem F5.
 */

export interface BrandingPreview {
  logoUrl: string;
  simboloUrl: string;
  marcaTexto: string;
  marcaSubtitulo: string;
  corPrimaria: string | null;
  corSecundaria: string | null;
  cep: string | null;
}

export const BRANDING_QUERY_KEY = ['empresa-config-branding'] as const;

const DEFAULT_BRANDING: BrandingPreview = {
  logoUrl: fallbackLogo,
  simboloUrl: fallbackSimbolo,
  marcaTexto: '',
  marcaSubtitulo: 'ERP',
  corPrimaria: null,
  corSecundaria: null,
  cep: null,
};

async function fetchBranding(): Promise<BrandingPreview> {
  if (!isSupabaseConfigured) return DEFAULT_BRANDING;
  const { data, error } = await supabase
    .from('empresa_config')
    .select('logo_url, simbolo_url, marca_texto, marca_subtitulo, nome_fantasia, cor_primaria, cor_secundaria, cep')
    .maybeSingle();

  if (error || !data) return DEFAULT_BRANDING;

  const row = data as {
    logo_url?: string | null;
    simbolo_url?: string | null;
    marca_texto?: string | null;
    marca_subtitulo?: string | null;
    nome_fantasia?: string | null;
    cor_primaria?: string | null;
    cor_secundaria?: string | null;
    cep?: string | null;
  };

  return {
    logoUrl: row.logo_url || fallbackLogo,
    simboloUrl: row.simbolo_url || fallbackSimbolo,
    marcaTexto: row.marca_texto || row.nome_fantasia || '',
    marcaSubtitulo: row.marca_subtitulo ?? 'ERP',
    corPrimaria: row.cor_primaria ?? null,
    corSecundaria: row.cor_secundaria ?? null,
    cep: row.cep ? row.cep.replace(/\D/g, '') : null,
  };
}

export function useBrandingPreview() {
  const query = useQuery({
    queryKey: BRANDING_QUERY_KEY,
    queryFn: fetchBranding,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    branding: query.data ?? DEFAULT_BRANDING,
    loading: query.isLoading,
    refetch: query.refetch,
  };
}

/**
 * Helper para invalidar o cache de branding após mudanças em
 * `Administracao` → `Empresa`.
 */
export function invalidateBrandingPreview(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: BRANDING_QUERY_KEY });
}