/**
 * Fluxo de Caixa — fetcher canônico via React Query.
 *
 * Substitui o `useEffect + useState` original em `FluxoCaixa.tsx`,
 * permitindo invalidação cross-módulo automática (ver
 * `src/services/_invalidationKeys.ts` → `fluxo-caixa`).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Lancamento, ContaBancaria } from "@/types/domain";

export interface FluxoCaixaData {
  lancamentos: Lancamento[];
  contasBancarias: ContaBancaria[];
}

export function useFluxoCaixaData(dataInicio: string, dataFim: string) {
  return useQuery<FluxoCaixaData>({
    queryKey: ["fluxo-caixa", dataInicio, dataFim],
    queryFn: async () => {
      const [{ data: lancs }, { data: contas }] = await Promise.all([
        supabase
          .from("financeiro_lancamentos")
          .select(
            "id, tipo, valor, saldo_restante, valor_pago, status, data_vencimento, data_pagamento, conta_bancaria_id, descricao, forma_pagamento, nota_fiscal_id, documento_pai_id, observacoes, contas_bancarias(descricao, bancos(nome))",
          )
          .eq("ativo", true)
          .gte("data_vencimento", dataInicio)
          .lte("data_vencimento", dataFim),
        supabase
          .from("contas_bancarias")
          .select("*, bancos(nome)")
          .eq("ativo", true),
      ]);
      return {
        lancamentos: (lancs as Lancamento[]) ?? [],
        contasBancarias: (contas as ContaBancaria[]) ?? [],
      };
    },
    staleTime: 60 * 1000,
  });
}
