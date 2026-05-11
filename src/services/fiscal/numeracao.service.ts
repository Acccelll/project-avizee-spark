/**
 * Numeração e chave de acesso atômica de NF-e.
 *
 * Wrappa as RPCs `proximo_numero_nfe` e `gerar_chave_acesso_nfe` (ambas
 * SECURITY DEFINER, baseadas em SEQUENCE no Postgres) e o update direto de
 * campos individuais em `notas_fiscais` (numero/chave/etc.).
 */

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type NotaFiscalUpdate = Database["public"]["Tables"]["notas_fiscais"]["Update"];

/** Próximo número de NF-e para a série indicada. */
export async function proximoNumeroNfe(serie: string): Promise<string> {
  const { data, error } = await supabase.rpc("proximo_numero_nfe", {
    p_serie: serie,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  const numero = String((row as { numero?: unknown } | null)?.numero ?? "");
  if (!numero) {
    throw new Error("RPC proximo_numero_nfe não retornou número.");
  }
  return numero;
}

/** Gera a chave de 44 dígitos com DV mod 11 server-side. */
export async function gerarChaveAcessoNfe(nfId: string): Promise<string> {
  const { data, error } = await supabase.rpc("gerar_chave_acesso_nfe", {
    p_nf_id: nfId,
  });
  if (error) throw error;
  const chave = String(data ?? "");
  if (chave.length !== 44) {
    throw new Error("RPC gerar_chave_acesso_nfe retornou chave inválida.");
  }
  return chave;
}

/**
 * Atualiza campos arbitrários de uma NF (uso pontual: número, chave_acesso, etc.).
 * Para mutações de domínio prefira `upsertNotaFiscalComItens` ou as RPCs de
 * lifecycle.
 */
export async function updateNotaFiscalCampo(
  id: string,
  patch: NotaFiscalUpdate,
): Promise<void> {
  const { error } = await supabase
    .from("notas_fiscais")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}