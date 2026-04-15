import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { FinanceiroAuxiliaresState } from "@/pages/financeiro/types";

const INITIAL_STATE: FinanceiroAuxiliaresState = {
  contasBancarias: [],
  contasContabeis: [],
};

export function useFinanceiroAuxiliares() {
  const [state, setState] = useState<FinanceiroAuxiliaresState>(INITIAL_STATE);

  const loadAuxiliares = useCallback(async () => {
    const [{ data: contas }, { data: contabeis }] = await Promise.all([
      supabase.from("contas_bancarias").select("*, bancos(nome)").eq("ativo", true),
      supabase
        .from("contas_contabeis")
        .select("id, codigo, descricao")
        .eq("ativo", true)
        .eq("aceita_lancamento", true)
        .order("codigo"),
    ]);

    setState({
      contasBancarias: contas || [],
      contasContabeis: contabeis || [],
    });
  }, []);

  useEffect(() => {
    loadAuxiliares();
  }, [loadAuxiliares]);

  return {
    ...state,
    loadAuxiliares,
  };
}
