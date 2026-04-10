import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
    onError: (err) => toast.error("Erro ao criar remessa: " + err.message),
  });

  const updateMutation = useMutation<void, Error, { id: string; payload: RemessaUpdate }>({
    mutationFn: ({ id, payload }) => updateRemessa(id, payload),
    onSuccess: () => {
      toast.success("Remessa atualizada!");
      invalidate();
    },
    onError: (err) => toast.error("Erro ao atualizar remessa: " + err.message),
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: deleteRemessa,
    onSuccess: () => {
      toast.success("Remessa removida!");
      invalidate();
    },
    onError: (err) => toast.error("Erro ao remover remessa: " + err.message),
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
