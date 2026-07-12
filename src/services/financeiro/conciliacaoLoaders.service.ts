/**
 * Loaders dedicados à página de Conciliação Bancária.
 * Extraído na Etapa 6.4 para tirar `supabase.from(...)` direto da página
 * (regra `mem://tech/camada-services-unica`).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Lancamento } from "@/types/domain";

export interface ContaBancariaDropdown {
  id: string;
  nome: string;
  banco?: string | null;
}

/** Contas bancárias ativas no dropdown da página. */
export async function listContasBancariasParaConciliacao(): Promise<ContaBancariaDropdown[]> {
  const { data, error } = await supabase
    .from("contas_bancarias")
    .select("id, descricao, bancos(nome)")
    .eq("ativo", true);
  if (error) throw error;
  return (data ?? []).map((d) => {
    const row = d as { id: string; descricao: string; bancos?: { nome: string } | null };
    return { id: row.id, nome: row.descricao, banco: row.bancos?.nome ?? null };
  });
}

const LANC_SELECT =
  "id, descricao, valor, data_vencimento, tipo, status, saldo_restante, nota_fiscal_id, documento_pai_id, origem_tipo, conta_bancaria_id, forma_pagamento, cliente_id, fornecedor_id, clientes(nome_razao_social), fornecedores(nome_razao_social), contas_bancarias(descricao, bancos(nome))";

/**
 * Carrega lançamentos da conta no período usando o eixo híbrido
 * `baixa + vencimento`:
 *  1) Títulos com baixa ativa no período (eixo data_baixa).
 *  2) Títulos abertos/parciais com vencimento até `dataFim` (inclui vencidos
 *     de períodos anteriores — candidatos a nova baixa/conciliação).
 */
export async function fetchLancamentosParaConciliacao(
  contaId: string | null,
  dataInicio: string,
  dataFim: string,
): Promise<Array<Lancamento & { data_baixa?: string | null }>> {
  const baixasQ = supabase
    .from("financeiro_baixas")
    .select(`lancamento_id, data_baixa, financeiro_lancamentos!inner(${LANC_SELECT})`)
    .is("estornada_em", null)
    .gte("data_baixa", dataInicio)
    .lte("data_baixa", dataFim);
  const vencQ = supabase
    .from("financeiro_lancamentos")
    .select(LANC_SELECT)
    .eq("ativo", true)
    .in("status", ["aberto", "parcial"])
    .lte("data_vencimento", dataFim)
    .order("data_vencimento", { ascending: true });
  if (contaId) {
    baixasQ.eq("conta_bancaria_id", contaId);
    vencQ.eq("conta_bancaria_id", contaId);
  }
  const [{ data: porBaixa }, { data: porVencimento }] = await Promise.all([baixasQ, vencQ]);

  const merged = new Map<string, Lancamento & { data_baixa?: string | null }>();
  ((porBaixa as Array<{
    lancamento_id: string;
    data_baixa: string;
    financeiro_lancamentos: Lancamento;
  }>) || []).forEach((row) => {
    if (!row.financeiro_lancamentos) return;
    merged.set(row.lancamento_id, { ...row.financeiro_lancamentos, data_baixa: row.data_baixa });
  });
  ((porVencimento as Lancamento[]) || []).forEach((l) => {
    if (!merged.has(l.id)) merged.set(l.id, l);
  });

  return Array.from(merged.values());
}