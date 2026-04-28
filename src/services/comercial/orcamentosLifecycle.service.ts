import { supabase } from "@/integrations/supabase/client";

export interface OrcamentoLifecycleResult {
  id: string;
  numero: string;
  status: string;
}

export async function enviarOrcamentoAprovacao(id: string): Promise<OrcamentoLifecycleResult> {
  const { data, error } = await supabase.rpc("enviar_orcamento_aprovacao" as never, {
    p_id: id,
  } as never);
  if (error) throw new Error(error.message);
  return data as OrcamentoLifecycleResult;
}

export async function aprovarOrcamento(id: string): Promise<OrcamentoLifecycleResult> {
  const { data, error } = await supabase.rpc("aprovar_orcamento" as never, {
    p_id: id,
  } as never);
  if (error) throw new Error(error.message);
  return data as OrcamentoLifecycleResult;
}