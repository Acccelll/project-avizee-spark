import axios from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

export interface ViaCepAddress {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  gia: string;
  ddd: string;
  siafi: string;
}

interface ViaCepErrorResponse {
  erro: true;
}

type ViaCepResponse = ViaCepAddress | ViaCepErrorResponse;

async function getViaCep(cep: string): Promise<ViaCepAddress> {
  const { data } = await axios.get<ViaCepResponse>(`https://viacep.com.br/ws/${cep}/json/`);

  if ("erro" in data) {
    throw new Error("CEP não encontrado");
  }

  return data;
}

export function useViaCep() {
  const queryClient = useQueryClient();
  const [currentCep, setCurrentCep] = useState("");

  const query = useQuery({
    queryKey: ["via-cep", currentCep],
    queryFn: () => getViaCep(currentCep),
    enabled: false,
    staleTime: 1000 * 60 * 60,
    retry: false,
  });

  async function fetchAddress(cep: string): Promise<ViaCepAddress | null> {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) {
      return null;
    }

    try {
      setCurrentCep(cleanCep);

      const result = await queryClient.fetchQuery({
        queryKey: ["via-cep", cleanCep],
        queryFn: () => getViaCep(cleanCep),
        staleTime: 1000 * 60 * 60,
      });

      return result;
    } catch {
      toast.error("Erro ao consultar CEP");
      return null;
    }
  }

  return {
    data: query.data,
    isLoading: query.isLoading || query.isFetching,
    error: query.error,
    fetchAddress,
  };
}
