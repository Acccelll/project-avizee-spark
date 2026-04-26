/**
 * Tipos e helpers para chamadas RPC ao PostgreSQL via Supabase.
 *
 * Centraliza o acesso tipado a `Database["public"]["Functions"]` para evitar
 * que hooks redeclarem assinaturas com `as any`. Use `RpcName`, `RpcArgs<…>`
 * e `RpcReturn<…>` para tipar callers; use `invokeRpc` quando preferir um
 * wrapper que já lança o erro do PostgREST e devolve o payload.
 *
 * O cliente Supabase gerado já é totalmente tipado, mas este módulo facilita
 * (a) descobrir o nome canônico das funções e (b) escrever testes que
 * stubbam RPCs sem perder type-safety.
 */

import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

export type RpcName = keyof Database["public"]["Functions"];

export type RpcArgs<N extends RpcName> =
  Database["public"]["Functions"][N]["Args"];

export type RpcReturn<N extends RpcName> =
  Database["public"]["Functions"][N]["Returns"];

/**
 * Invoca uma RPC pública e devolve o payload já tipado, lançando em caso
 * de erro do PostgREST.
 *
 * @example
 *   const num = await invokeRpc("proximo_numero_orcamento", {});
 */
export async function invokeRpc<N extends RpcName>(
  name: N,
  args: RpcArgs<N>,
): Promise<RpcReturn<N>> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as RpcReturn<N>;
}