import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NotaPendente {
  id: string;
  numero: string | null;
  data_emissao: string | null;
  valor_total: number | null;
  forma_pagamento: string | null;
  condicao_pagamento: string | null;
  tipo: string;
  fornecedor_id: string | null;
  cnpj_emitente: string | null;
  nome_emitente: string | null;
  fornecedores?: { nome_razao_social: string } | null;
}

/**
 * Fila de NF-e de entrada que geram financeiro mas estão sem forma de
 * pagamento definida. Usada no painel "Pendências" do Financeiro.
 */
export function useNotasPendentesForma() {
  return useQuery({
    queryKey: ["notas-pendentes-forma"],
    queryFn: async (): Promise<NotaPendente[]> => {
      const { data, error } = await supabase
        .from("notas_fiscais")
        .select(
          "id, numero, data_emissao, valor_total, forma_pagamento, condicao_pagamento, tipo, fornecedor_id, cnpj_emitente, nome_emitente, fornecedores(nome_razao_social)",
        )
        .eq("ativo", true)
        .eq("tipo", "entrada")
        .eq("gera_financeiro", true)
        .or("forma_pagamento.is.null,forma_pagamento.eq.")
        .neq("origem", "importacao_historica")
        .not("status", "in", "(cancelada,cancelada_sefaz,inativada)")
        .order("data_emissao", { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data || []) as NotaPendente[];
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}