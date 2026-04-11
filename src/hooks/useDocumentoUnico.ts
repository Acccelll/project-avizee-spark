import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TipoDocumento = "cpf" | "cnpj";

const CPF_LENGTH = 11;
const CNPJ_LENGTH = 14;

async function checkDocumentoUnico(
  tipo: TipoDocumento,
  valor: string,
  excludeId?: string,
): Promise<boolean> {
  const digits = valor.replace(/\D/g, "");

  let query = supabase
    .from("clientes")
    .select("id", { count: "exact", head: true })
    .eq("cpf_cnpj", digits);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { count, error } = await query;
  if (error) throw new Error(error.message);

  // Also check fornecedores table
  let queryForn = supabase
    .from("fornecedores")
    .select("id", { count: "exact", head: true })
    .eq("cpf_cnpj", digits);

  if (excludeId) {
    queryForn = queryForn.neq("id", excludeId);
  }

  const { count: countForn, error: errorForn } = await queryForn;
  if (errorForn) throw new Error(errorForn.message);

  return (count ?? 0) + (countForn ?? 0) === 0;
}

export interface UseDocumentoUnicoReturn {
  isUnique: boolean | undefined;
  isLoading: boolean;
}

export function useDocumentoUnico(
  tipo: TipoDocumento,
  valor: string,
  excludeId?: string,
): UseDocumentoUnicoReturn {
  const expectedLength = tipo === "cpf" ? CPF_LENGTH : CNPJ_LENGTH;
  const digits = valor.replace(/\D/g, "");
  const isReady = !!valor && digits.length === expectedLength;

  const { data: isUnique, isLoading } = useQuery<boolean>({
    queryKey: ["documento-unico", tipo, digits, excludeId],
    queryFn: () => checkDocumentoUnico(tipo, digits, excludeId),
    enabled: isReady,
    staleTime: 30 * 1000,
  });

  return { isUnique, isLoading };
}
