import { supabase } from "@/integrations/supabase/client";

export interface CorreiosEvento {
  descricao?: string;
  tipo?: string;
  unidade?: { nome?: string; endereco?: { cidade?: string } };
  dtHrCriado?: string;
}

export interface CorreiosTrackingResponse {
  error?: string;
  objetos?: Array<{ eventos?: CorreiosEvento[] }>;
  /** "fallback_mock" quando a Edge Function retornou dados simulados. */
  warning?: string;
  /** Presente no modo mock — contém dados simulados de rastreio. */
  data?: { eventos?: CorreiosEvento[] };
}

export interface CorreiosEventoNormalizado {
  descricao: string;
  local: string | null;
  data_hora: string;
}

export function normalizarEventos(
  tracking: CorreiosTrackingResponse,
  remessaId: string,
): Array<CorreiosEventoNormalizado & { remessa_id: string }> {
  const isMock = tracking.warning === "fallback_mock";
  const raw: CorreiosEvento[] = isMock
    ? (tracking.data?.eventos ?? [])
    : (tracking.objetos?.[0]?.eventos ?? []);

  return raw.map((ev) => ({
    remessa_id: remessaId,
    descricao: ev.descricao ?? ev.tipo ?? "Evento",
    local: ev.unidade?.endereco?.cidade ?? ev.unidade?.nome ?? null,
    data_hora: ev.dtHrCriado ?? new Date().toISOString(),
  }));
}

export async function fetchTracking(codigo: string): Promise<CorreiosTrackingResponse> {
  const codigoSanitizado = codigo.trim().toUpperCase().replace(/\s+/g, "");
  if (!codigoSanitizado) throw new Error("Código de rastreio inválido");

  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string ?? "").replace(/\/$/, "");
  const url = `${supabaseUrl}/functions/v1/correios-api?action=rastrear&codigo=${encodeURIComponent(codigoSanitizado)}`;

  const { data: sessionData } = await supabase.auth.getSession();
  const token =
    sessionData.session?.access_token ??
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ??
    "";

  const res = await fetch(url, {
    headers: {
      apikey: (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ?? "",
      Authorization: `Bearer ${token}`,
    },
  });

  const tracking = (await res.json()) as CorreiosTrackingResponse;
  if (!res.ok || tracking.error) {
    throw new Error(tracking.error ?? `Erro ao consultar rastreio (${res.status})`);
  }

  return tracking;
}
