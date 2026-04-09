import { useState } from "react";
import { toast } from "sonner";

interface CnpjResult {
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  email: string;
  telefone: string;
}

export function useCnpjLookup() {
  const [loading, setLoading] = useState(false);

  const buscarCnpj = async (cnpj: string): Promise<CnpjResult | null> => {
    const cleanCnpj = cnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) return null;

    setLoading(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      if (!res.ok) {
        if (res.status === 404) {
          toast.error("CNPJ não encontrado na base da Receita Federal");
        } else {
          toast.error("Erro ao consultar CNPJ. Tente novamente.");
        }
        return null;
      }
      const data = await res.json();

      const telefone = data.ddd_telefone_1
        ? `(${data.ddd_telefone_1.substring(0, 2)}) ${data.ddd_telefone_1.substring(2)}`
        : "";

      toast.success("Dados do CNPJ preenchidos automaticamente!");

      return {
        razao_social: data.razao_social || "",
        nome_fantasia: data.nome_fantasia || "",
        cnpj: cleanCnpj,
        logradouro: data.logradouro || "",
        numero: data.numero || "",
        complemento: data.complemento || "",
        bairro: data.bairro || "",
        municipio: data.municipio || "",
        uf: data.uf || "",
        cep: data.cep ? data.cep.replace(/\D/g, "") : "",
        email: data.email || "",
        telefone,
      };
    } catch {
      toast.error("Erro de conexão ao consultar CNPJ");
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { buscarCnpj, loading };
}
