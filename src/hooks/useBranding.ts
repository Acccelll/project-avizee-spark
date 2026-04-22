import { useBrandingPreview } from "./useBrandingPreview";

/**
 * useBranding
 *
 * Carrega branding (logo + símbolo + textos) de empresa_config.
 * Útil em telas públicas (login, signup, recuperação) onde
 * AppConfigContext ainda não está montado.
 *
 * Sempre retorna fallbacks locais quando o banco está vazio,
 * evitando "logo quebrada" durante autenticação inicial.
 */
export interface BrandingValues {
  logoUrl: string;
  simboloUrl: string;
  marcaTexto: string;
  marcaSubtitulo: string;
  loading: boolean;
}

/**
 * Wrapper retrocompatível que delega para `useBrandingPreview` (cache via
 * React Query). Mantido para não quebrar consumidores das telas públicas
 * (Login, Signup, recuperação) que dependiam desta API.
 */
export function useBranding(): BrandingValues {
  const { branding, loading } = useBrandingPreview();
  return {
    logoUrl: branding.logoUrl,
    simboloUrl: branding.simboloUrl,
    marcaTexto: branding.marcaTexto,
    marcaSubtitulo: branding.marcaSubtitulo,
    loading,
  };
}