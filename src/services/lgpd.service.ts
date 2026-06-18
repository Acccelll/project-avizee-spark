/**
 * LGPD — solicitações de exportação/anonimização de dados de titulares.
 *
 * Backend:
 *  - Tabela `lgpd_solicitacoes` (RLS admin-only).
 *  - RPC `exportar_dados_titular(_tipo, _id)` retorna JSON completo.
 *  - RPC `anonimizar_titular(_tipo, _id, _motivo)` substitui PII preservando
 *    NFs autorizadas e histórico financeiro.
 */
import { supabase } from "@/integrations/supabase/client";

export type TitularTipo = "cliente" | "fornecedor" | "funcionario";
export type LgpdTipo = "exportar" | "anonimizar";
export type LgpdStatus = "pendente" | "concluida" | "erro" | "cancelada";

export interface LgpdSolicitacao {
  id: string;
  titular_tipo: TitularTipo;
  titular_id: string;
  titular_descricao: string | null;
  tipo: LgpdTipo;
  status: LgpdStatus;
  motivo: string | null;
  payload: unknown;
  solicitado_por: string | null;
  concluido_em: string | null;
  created_at: string;
  updated_at: string;
}

export async function listSolicitacoes(limit = 50): Promise<LgpdSolicitacao[]> {
  const { data, error } = await supabase
    .from("lgpd_solicitacoes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as LgpdSolicitacao[];
}

export async function exportarTitular(tipo: TitularTipo, id: string): Promise<unknown> {
  const { data, error } = await supabase.rpc("exportar_dados_titular", {
    _tipo: tipo,
    _id: id,
  });
  if (error) throw error;
  return data;
}

export async function anonimizarTitular(
  tipo: TitularTipo,
  id: string,
  motivo: string,
): Promise<{ ok: boolean; marker: string }> {
  const { data, error } = await supabase.rpc("anonimizar_titular", {
    _tipo: tipo,
    _id: id,
    _motivo: motivo,
  });
  if (error) throw error;
  return data as { ok: boolean; marker: string };
}

/** Busca rápida de titular para o select do form. Limite enxuto (typeahead). */
export async function buscarTitulares(
  tipo: TitularTipo,
  query: string,
): Promise<Array<{ id: string; descricao: string }>> {
  if (tipo === "cliente") {
    const { data, error } = await supabase
      .from("clientes")
      .select("id, nome_razao_social, cpf_cnpj")
      .ilike("nome_razao_social", `%${query}%`)
      .limit(20);
    if (error) throw error;
    return (data ?? []).map((r) => ({ id: r.id, descricao: `${r.nome_razao_social} · ${r.cpf_cnpj ?? ""}` }));
  }
  if (tipo === "fornecedor") {
    const { data, error } = await supabase
      .from("fornecedores")
      .select("id, nome_razao_social, cpf_cnpj")
      .ilike("nome_razao_social", `%${query}%`)
      .limit(20);
    if (error) throw error;
    return (data ?? []).map((r) => ({ id: r.id, descricao: `${r.nome_razao_social} · ${r.cpf_cnpj ?? ""}` }));
  }
  const { data, error } = await supabase
    .from("funcionarios")
    .select("id, nome, cpf")
    .ilike("nome", `%${query}%`)
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, descricao: `${r.nome} · ${r.cpf ?? ""}` }));
}