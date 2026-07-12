import { supabase } from "@/integrations/supabase/client";
import type { FaturaImportInput } from "./types";

export interface ImportarFaturaCartaoArgs extends FaturaImportInput {
  empresa_id: string;
  cartao_id: string;
  origem?: string;
}

export async function importarFaturaCartao(args: ImportarFaturaCartaoArgs) {
  const { data, error } = await supabase.rpc("cartao_importar_fatura", {
    p_empresa_id: args.empresa_id,
    p_cartao_id: args.cartao_id,
    p_competencia: args.competencia,
    p_data_vencimento: args.data_vencimento,
    p_data_fechamento: args.data_fechamento ?? args.data_vencimento,
    p_valor_total: args.valor_total,
    p_origem: args.origem ?? `pdf_${args.emissor}`,
    p_linhas: args.lancamentos as unknown as never,
  } as never);
  if (error) throw error;
  return data as { fatura_id: string; inseridas: number; duplicadas: number };
}