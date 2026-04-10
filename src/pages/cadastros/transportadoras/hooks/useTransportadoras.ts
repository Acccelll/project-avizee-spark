import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

export type TransportadoraRow = Database["public"]["Tables"]["transportadoras"]["Row"];
export type TransportadoraInsert =
  Database["public"]["Tables"]["transportadoras"]["Insert"];
export type TransportadoraUpdate =
  Database["public"]["Tables"]["transportadoras"]["Update"];

const QUERY_KEY = "transportadoras";

async function fetchTransportadoras(): Promise<TransportadoraRow[]> {
  const { data, error } = await supabase
    .from("transportadoras")
    .select("*")
    .order("nome_razao_social");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export function useTransportadoras() {
  const queryClient = useQueryClient();

  const query = useQuery<TransportadoraRow[], Error>({
    queryKey: [QUERY_KEY],
    queryFn: fetchTransportadoras,
    staleTime: 5 * 60 * 1000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });

  const createMutation = useMutation<TransportadoraRow, Error, TransportadoraInsert>({
    mutationFn: async (payload) => {
      const { data, error } = await supabase
        .from("transportadoras")
        .insert(payload)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      toast.success("Transportadora criada!");
      invalidate();
    },
    onError: (err) => toast.error("Erro ao criar transportadora: " + err.message),
  });

  const updateMutation = useMutation<void, Error, { id: string; payload: TransportadoraUpdate }>({
    mutationFn: async ({ id, payload }) => {
      const { error } = await supabase.from("transportadoras").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Transportadora atualizada!");
      invalidate();
    },
    onError: (err) => toast.error("Erro ao atualizar transportadora: " + err.message),
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from("transportadoras")
        .update({ ativo: false })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Transportadora removida!");
      invalidate();
    },
    onError: (err) => toast.error("Erro ao remover transportadora: " + err.message),
  });

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    create: createMutation.mutateAsync,
    update: (id: string, payload: TransportadoraUpdate) =>
      updateMutation.mutateAsync({ id, payload }),
    remove: deleteMutation.mutateAsync,
    isSaving: createMutation.isPending || updateMutation.isPending,
  };
}
