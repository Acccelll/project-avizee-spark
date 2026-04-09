import { useState } from "react";
import { toast } from "sonner";

interface ViaCepResult {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
}

export function useViaCep() {
  const [loading, setLoading] = useState(false);

  const buscarCep = async (cep: string): Promise<ViaCepResult | null> => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return null;

    setLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (data.erro) {
        toast.error("CEP não encontrado");
        return null;
      }
      return {
        logradouro: data.logradouro || "",
        bairro: data.bairro || "",
        localidade: data.localidade || "",
        uf: data.uf || "",
      };
    } catch {
      toast.error("Erro ao consultar CEP");
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { buscarCep, loading };
}
