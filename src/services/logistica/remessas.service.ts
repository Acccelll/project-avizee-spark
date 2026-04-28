import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/errorMessages";
import {
  fetchTracking,
  normalizarEventos,
  type CorreiosEventoNormalizado,
} from "@/services/correios.service";
import type { Database } from "@/integrations/supabase/types";

export type Remessa = Database["public"]["Tables"]["remessas"]["Row"];
export type RemessaInsert = Database["public"]["Tables"]["remessas"]["Insert"];
export type RemessaUpdate = Database["public"]["Tables"]["remessas"]["Update"];
export type RemessaEvento = Database["public"]["Tables"]["remessa_eventos"]["Row"];
export type RemessaEventoInsert = Database["public"]["Tables"]["remessa_eventos"]["Insert"];

const QUERY_KEY = "remessas";

// ── Service functions ──────────────────────────────────────────────────────────

export async function fetchRemessas(): Promise<Remessa[]> {
  const { data, error } = await supabase
    .from("remessas")
    .select("*")
    .eq("ativo", true)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createRemessa(payload: RemessaInsert): Promise<Remessa> {
  const { data, error } = await supabase
    .from("remessas")
    .insert(payload)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateRemessa(id: string, payload: RemessaUpdate): Promise<void> {
  const { error } = await supabase.from("remessas").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteRemessa(id: string): Promise<void> {
  const { error } = await supabase.from("remessas").update({ ativo: false }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Carrega uma remessa pelo id (usado pela página de edição). */
export async function getRemessaById(id: string): Promise<Remessa | null> {
  const { data, error } = await supabase
    .from("remessas")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

/** Atualiza apenas o campo `status_transporte` de uma remessa (ação rápida). */
export async function updateStatusTransporte(
  remessaId: string,
  status: string,
): Promise<void> {
  const { error } = await supabase
    .from("remessas")
    .update({ status_transporte: status })
    .eq("id", remessaId);
  if (error) throw new Error(error.message);
}

/**
 * Localiza a remessa ativa associada a uma OV e código de rastreio
 * (usado para alimentar o `remessa_id` no TrackingModal a partir de uma Entrega).
 */
export async function findRemessaByOvAndTracking(
  ordemVendaId: string,
  codigoRastreio: string,
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("remessas")
    .select("id")
    .eq("ordem_venda_id", ordemVendaId)
    .eq("ativo", true)
    .eq("codigo_rastreio", codigoRastreio)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

/** Lista os eventos de rastreio de uma remessa, mais recentes primeiro. */
export async function listEventos(remessaId: string): Promise<RemessaEvento[]> {
  const { data, error } = await supabase
    .from("remessa_eventos")
    .select("*")
    .eq("remessa_id", remessaId)
    .order("data_hora", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as RemessaEvento[];
}

/** Retorna apenas os IDs das remessas ativas associadas a uma OV. */
export async function listRemessaIdsByOv(ordemVendaId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("remessas")
    .select("id")
    .eq("ordem_venda_id", ordemVendaId)
    .eq("ativo", true);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.id);
}

/** Insere um novo evento manual de rastreio em uma remessa. */
export async function addEvento(input: {
  remessaId: string;
  descricao: string;
  local?: string | null;
}): Promise<void> {
  const payload: RemessaEventoInsert = {
    remessa_id: input.remessaId,
    descricao: input.descricao,
    local: input.local ?? null,
  };
  const { error } = await supabase.from("remessa_eventos").insert(payload);
  if (error) throw new Error(error.message);
}

/**
 * Canonical tracking function used by ALL logística views.
 *
 * Queries the Correios API, normalises events, deduplicates against DB and
 * persists only genuinely new events.  Mock data is returned inline but never
 * persisted.
 *
 * @returns { novos, isMock, eventos } where `eventos` is the full list after
 *   DB refresh (or the mock list when `isMock` is true).
 */
export async function trackAndPersistEventos(
  codigo: string,
  remessaId: string,
): Promise<{ novos: number; isMock: boolean; eventos: CorreiosEventoNormalizado[] }> {
  const tracking = await fetchTracking(codigo);
  const isMock = tracking.warning === "fallback_mock";
  const eventosNormalizados = normalizarEventos(tracking, remessaId);

  if (isMock) {
    return { novos: 0, isMock: true, eventos: eventosNormalizados };
  }

  // Deduplicate against existing DB events
  const { data: existentes } = await supabase
    .from("remessa_eventos")
    .select("descricao, local, data_hora")
    .eq("remessa_id", remessaId);

  const eventKey = (e: { descricao: string; local: string | null; data_hora: string }) =>
    `${e.data_hora}::${e.descricao}::${e.local ?? ""}`;
  const existentesSet = new Set((existentes ?? []).map(eventKey));
  const novosEventos = eventosNormalizados.filter((e) => !existentesSet.has(eventKey(e)));

  if (novosEventos.length > 0) {
    await supabase.from("remessa_eventos").insert(novosEventos);
  }

  return { novos: novosEventos.length, isMock: false, eventos: eventosNormalizados };
}

/** @deprecated Use trackAndPersistEventos instead */
export async function trackCorreios(
  codigo: string,
  remessaId: string,
): Promise<Array<CorreiosEventoNormalizado & { remessa_id: string }>> {
  const tracking = await fetchTracking(codigo);
  return normalizarEventos(tracking, remessaId);
}

// ── Hooks ──────────────────────────────────────────────────────────────────────

export function useRemessas() {
  const queryClient = useQueryClient();

  const query = useQuery<Remessa[], Error>({
    queryKey: [QUERY_KEY],
    queryFn: fetchRemessas,
    staleTime: 2 * 60 * 1000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });

  const createMutation = useMutation<Remessa, Error, RemessaInsert>({
    mutationFn: createRemessa,
    onSuccess: () => {
      toast.success("Remessa criada com sucesso!");
      invalidate();
    },
    onError: (err) => toast.error(getUserFriendlyError(err)),
  });

  const updateMutation = useMutation<void, Error, { id: string; payload: RemessaUpdate }>({
    mutationFn: ({ id, payload }) => updateRemessa(id, payload),
    onSuccess: () => {
      toast.success("Remessa atualizada!");
      invalidate();
    },
    onError: (err) => toast.error(getUserFriendlyError(err)),
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: deleteRemessa,
    onSuccess: () => {
      toast.success("Remessa removida!");
      invalidate();
    },
    onError: (err) => toast.error(getUserFriendlyError(err)),
  });

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    create: createMutation.mutateAsync,
    update: (id: string, payload: RemessaUpdate) =>
      updateMutation.mutateAsync({ id, payload }),
    remove: deleteMutation.mutateAsync,
    isSaving: createMutation.isPending || updateMutation.isPending,
  };
}
