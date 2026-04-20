import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TipoDocumento = "cpf" | "cnpj";
export type DocumentoTable = "clientes" | "fornecedores" | "transportadoras" | "funcionarios";

const CPF_LENGTH = 11;
const CNPJ_LENGTH = 14;

async function checkDocumentoUnico(
  tipo: TipoDocumento,
  valor: string,
  excludeId?: string,
  excludeTable?: DocumentoTable,
): Promise<boolean> {
  const digits = valor.replace(/\D/g, "");

  // Check clientes
  let queryClientes = supabase
    .from("clientes")
    .select("id", { count: "exact", head: true })
    .eq("cpf_cnpj", digits);

  if (excludeId && excludeTable === "clientes") {
    queryClientes = queryClientes.neq("id", excludeId);
  }

  const { count: countClientes, error: errorClientes } = await queryClientes;
  if (errorClientes) throw new Error(errorClientes.message);

  // Check fornecedores
  let queryForn = supabase
    .from("fornecedores")
    .select("id", { count: "exact", head: true })
    .eq("cpf_cnpj", digits);

  if (excludeId && excludeTable === "fornecedores") {
    queryForn = queryForn.neq("id", excludeId);
  }

  const { count: countForn, error: errorForn } = await queryForn;
  if (errorForn) throw new Error(errorForn.message);

  // Check funcionarios (only CPF applies)
  let countFunc = 0;
  if (tipo === "cpf") {
    let queryFunc = supabase
      .from("funcionarios")
      .select("id", { count: "exact", head: true })
      .eq("cpf", digits);
    if (excludeId && excludeTable === "funcionarios") {
      queryFunc = queryFunc.neq("id", excludeId);
    }
    const { count, error } = await queryFunc;
    if (error) throw new Error(error.message);
    countFunc = count ?? 0;
  }

  return (countClientes ?? 0) + (countForn ?? 0) + countFunc === 0;
}

export interface UseDocumentoUnicoReturn {
  isUnique: boolean | undefined;
  isLoading: boolean;
}

export function useDocumentoUnico(
  tipo: TipoDocumento,
  valor: string,
  excludeId?: string,
  excludeTable?: DocumentoTable,
): UseDocumentoUnicoReturn {
  const expectedLength = tipo === "cpf" ? CPF_LENGTH : CNPJ_LENGTH;
  const digits = valor.replace(/\D/g, "");
  const isReady = !!valor && digits.length === expectedLength;

  const { data: isUnique, isLoading } = useQuery<boolean>({
    queryKey: ["documento-unico", tipo, digits, excludeId, excludeTable],
    queryFn: () => checkDocumentoUnico(tipo, digits, excludeId, excludeTable),
    enabled: isReady,
    staleTime: 30 * 1000,
  });

  return { isUnique, isLoading };
}
