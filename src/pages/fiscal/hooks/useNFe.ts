import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/errorMessages";
import type { Database } from "@/integrations/supabase/types";

type NotaFiscalRow = Database["public"]["Tables"]["notas_fiscais"]["Row"];
type NotaFiscalItemRow = Database["public"]["Tables"]["notas_fiscais_itens"]["Row"];
type NotaFiscalInsert = Database["public"]["Tables"]["notas_fiscais"]["Insert"];
type NotaFiscalUpdate = Database["public"]["Tables"]["notas_fiscais"]["Update"];

export interface NFeComItens extends NotaFiscalRow {
  itens?: NotaFiscalItemRow[];
}

export interface NFeFiltros {
  search?: string;
  status?: string;
  dataInicio?: string;
  dataFim?: string;
}

async function fetchNFes(filtros?: NFeFiltros): Promise<NotaFiscalRow[]> {
  let query = supabase
    .from("notas_fiscais")
    .select("*")
    .eq("ativo", true)
    .eq("modelo_documento", "55")
    .order("created_at", { ascending: false });

  if (filtros?.status) query = query.eq("status", filtros.status);
  if (filtros?.search) query = query.ilike("numero", `%${filtros.search}%`);
  if (filtros?.dataInicio) query = query.gte("data_emissao", filtros.dataInicio);
  if (filtros?.dataFim) query = query.lte("data_emissao", filtros.dataFim);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function useNFe(filtros?: NFeFiltros) {
  return useQuery({
    queryKey: ["nfe", filtros],
    queryFn: () => fetchNFes(filtros),
    staleTime: 5 * 60 * 1000,
  });
}

export function useNFeMutation() {
  const queryClient = useQueryClient();

  const criar = useMutation({
    mutationFn: async (dados: NotaFiscalInsert) => {
      const { data, error } = await supabase
        .from("notas_fiscais")
        .insert({ ...dados, modelo_documento: "55" })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nfe"] });
      toast.success("NF-e criada com sucesso");
    },
    onError: (err: Error) => toast.error(getUserFriendlyError(err)),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: NotaFiscalUpdate }) => {
      const { error } = await supabase
        .from("notas_fiscais")
        .update(dados)
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nfe"] });
      toast.success("NF-e atualizada");
    },
    onError: (err: Error) => toast.error(getUserFriendlyError(err)),
  });

  return { criar, atualizar };
}

export function useCancelarNFe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { error } = await supabase
        .from("notas_fiscais")
        .update({ status: "cancelada", observacoes: motivo })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nfe"] });
      toast.success("NF-e cancelada");
    },
    onError: (err: Error) => toast.error(getUserFriendlyError(err)),
  });
}
