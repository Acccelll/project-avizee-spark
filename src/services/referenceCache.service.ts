import { supabase } from "@/integrations/supabase/client";
import type {
  ClienteRef,
  FornecedorRef,
  ContaBancariaRef,
  GrupoProdutoRef,
  FormaPagamentoRef,
} from "@/hooks/useReferenceCache";

export async function fetchClientesRef(opts: { ativosOnly: boolean; limit: number }): Promise<ClienteRef[]> {
  let q = supabase
    .from("clientes")
    .select("id, nome_razao_social")
    .order("nome_razao_social")
    .limit(opts.limit);
  if (opts.ativosOnly) q = q.eq("ativo", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ClienteRef[];
}

export async function fetchFornecedoresRef(opts: { ativosOnly: boolean; limit: number }): Promise<FornecedorRef[]> {
  let q = supabase
    .from("fornecedores")
    .select("id, nome_razao_social")
    .order("nome_razao_social")
    .limit(opts.limit);
  if (opts.ativosOnly) q = q.eq("ativo", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as FornecedorRef[];
}

export async function fetchContasBancariasRef(opts: { ativasOnly: boolean }): Promise<ContaBancariaRef[]> {
  let q = supabase.from("contas_bancarias").select("id, descricao").order("descricao");
  if (opts.ativasOnly) q = q.eq("ativo", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ContaBancariaRef[];
}

export async function fetchGruposProdutoRef(opts: { ativosOnly: boolean }): Promise<GrupoProdutoRef[]> {
  let q = supabase.from("grupos_produto").select("id, nome").order("nome");
  if (opts.ativosOnly) q = q.eq("ativo", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as GrupoProdutoRef[];
}

export async function fetchFormasPagamentoRef(opts: { ativasOnly: boolean }): Promise<FormaPagamentoRef[]> {
  let q = supabase
    .from("formas_pagamento")
    .select("id, descricao, tipo, parcelas, prazo_dias")
    .order("descricao");
  if (opts.ativasOnly) q = q.eq("ativo", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as FormaPagamentoRef[];
}