import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type NotaFiscalRow = Database["public"]["Tables"]["notas_fiscais"]["Row"];
type NotaFiscalInsert = Database["public"]["Tables"]["notas_fiscais"]["Insert"];

export interface NFCeFiltros {
  search?: string;
  status?: string;
  dataInicio?: string;
  dataFim?: string;
}

async function fetchNFCes(filtros?: NFCeFiltros): Promise<NotaFiscalRow[]> {
  let query = supabase
    .from("notas_fiscais")
    .select("*")
    .eq("ativo", true)
    .eq("modelo_documento", "65")
    .order("created_at", { ascending: false });

  if (filtros?.status) query = query.eq("status", filtros.status);
  if (filtros?.search) query = query.ilike("numero", `%${filtros.search}%`);
  if (filtros?.dataInicio) query = query.gte("data_emissao", filtros.dataInicio);
  if (filtros?.dataFim) query = query.lte("data_emissao", filtros.dataFim);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function useNFCe(filtros?: NFCeFiltros) {
  return useQuery({
    queryKey: ["nfce", filtros],
    queryFn: () => fetchNFCes(filtros),
    staleTime: 5 * 60 * 1000,
  });
}

export function useNFCeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dados: NotaFiscalInsert) => {
      const { data, error } = await supabase
        .from("notas_fiscais")
        .insert({ ...dados, modelo_documento: "65" })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nfce"] });
      toast.success("NFC-e emitida com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
