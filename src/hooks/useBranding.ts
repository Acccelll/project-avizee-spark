import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import fallbackLogo from "@/assets/brand-logotipo.png";
import fallbackSimbolo from "@/assets/brand-simbolo.png";

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

export function useBranding(): BrandingValues {
  const [state, setState] = useState<BrandingValues>({
    logoUrl: fallbackLogo,
    simboloUrl: fallbackSimbolo,
    marcaTexto: "",
    marcaSubtitulo: "ERP",
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    if (!supabase) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    supabase
      .from("empresa_config")
      .select("logo_url, simbolo_url, marca_texto, marca_subtitulo, nome_fantasia")
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setState((s) => ({ ...s, loading: false }));
          return;
        }
        const row = data as {
          logo_url?: string | null;
          simbolo_url?: string | null;
          marca_texto?: string | null;
          marca_subtitulo?: string | null;
          nome_fantasia?: string | null;
        };
        setState({
          logoUrl: row.logo_url || fallbackLogo,
          simboloUrl: row.simbolo_url || fallbackSimbolo,
          marcaTexto: row.marca_texto || row.nome_fantasia || "",
          marcaSubtitulo: row.marca_subtitulo ?? "ERP",
          loading: false,
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}