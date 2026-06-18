/**
 * Persistência do rascunho de NF-e gerado pelo wizard.
 * Encapsula `INSERT` na tabela `notas_fiscais` + `notas_fiscais_itens`
 * + marcação opcional de status_faturamento na Ordem de Venda associada.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  buildItensPayload,
  buildNotaFiscalRascunho,
  calcularTotaisWizard,
  type TotaisWizard,
} from "./buildPayload";
import type { WizardData } from "@/pages/faturamento/emitir-nfe/schema";

export interface SalvarRascunhoResult {
  id: string;
  totais: TotaisWizard;
}

export async function salvarRascunhoNFe(
  data: WizardData,
): Promise<SalvarRascunhoResult> {
  const totais = calcularTotaisWizard(data);
  const cabecalho = buildNotaFiscalRascunho(data, totais);

  const { data: nfRow, error: nfErr } = await supabase
    .from("notas_fiscais")
    .insert([cabecalho as never])
    .select("id")
    .single();
  if (nfErr) throw nfErr;

  const itensPayload = buildItensPayload(nfRow!.id, data.itens);
  const { error: itErr } = await supabase
    .from("notas_fiscais_itens")
    .insert(itensPayload as never);
  if (itErr) throw itErr;

  if (data.ordem_venda_id) {
    try {
      await supabase
        .from("ordens_venda")
        .update({ status_faturamento: "faturado" })
        .eq("id", data.ordem_venda_id);
    } catch {
      /* não bloqueia: status pode ser ajustado posteriormente */
    }
  }

  return { id: nfRow!.id, totais };
}