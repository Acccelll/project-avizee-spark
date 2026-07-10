/**
 * Motor de regras + aliases do Financeiro Inteligente 2.0 (Épico B).
 *
 * Camada declarativa que sugere fornecedor / centro de custo /
 * conta contábil a partir da descrição bruta de uma transação
 * (extrato OFX, linha de fatura de cartão, etc.).
 *
 * Ordem de precedência:
 *   1. Aliases exatos (mesma `descricao_normalizada`).
 *   2. Regras declarativas por padrão substring/regex (maior prioridade primeiro).
 *
 * Não persiste nada — é PURO consumo. A persistência do resultado
 * fica a cargo do chamador (extrato_importacoes.sugestao_*).
 */

import { supabase } from "@/integrations/supabase/client";

export interface RuleHint {
  fornecedor_id?: string | null;
  cliente_id?: string | null;
  centro_custo_id?: string | null;
  conta_contabil_id?: string | null;
  fonte: "alias" | "regra" | "nenhum";
  motivo: string;
  regra_id?: string | null;
  alias_id?: string | null;
  hits?: number;
}

interface FinanceiroAlias {
  id: string;
  descricao_normalizada: string;
  fornecedor_id: string | null;
  cliente_id: string | null;
  centro_custo_id: string | null;
  conta_contabil_id: string | null;
  hits: number;
}

interface FinanceiroRegra {
  id: string;
  nome: string;
  padrao_tipo: string;
  padrao: string;
  quando_tipo: string;
  prioridade: number;
  ativo: boolean;
  aplica_fornecedor_id: string | null;
  aplica_centro_custo_id: string | null;
  aplica_conta_contabil_id: string | null;
}

/** Normalização canônica: usada tanto para aliases quanto para regras. */
export function normalizarDescricao(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    // eslint-disable-next-line no-misleading-character-class
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\d{5,}/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Aplica aliases e regras à descrição de uma transação e devolve o
 * primeiro match (aliases têm prioridade sobre regras).
 */
export function aplicarRegrasEAliases(params: {
  descricao: string;
  tipo: "debito" | "credito";
  aliases: FinanceiroAlias[];
  regras: FinanceiroRegra[];
}): RuleHint {
  const desc = normalizarDescricao(params.descricao);

  // 1) Alias exato (chave única por empresa_id + descricao_normalizada).
  const alias = params.aliases.find((a) => a.descricao_normalizada === desc);
  if (alias) {
    return {
      fornecedor_id: alias.fornecedor_id,
      cliente_id: alias.cliente_id,
      centro_custo_id: alias.centro_custo_id,
      conta_contabil_id: alias.conta_contabil_id,
      fonte: "alias",
      motivo: `alias exato (${alias.hits} confirmações)`,
      alias_id: alias.id,
      hits: alias.hits,
    };
  }

  // 2) Regras — maior prioridade primeiro.
  const ordenadas = [...params.regras]
    .filter((r) => r.ativo && (r.quando_tipo === params.tipo || r.quando_tipo === "ambos"))
    .sort((a, b) => b.prioridade - a.prioridade);

  for (const regra of ordenadas) {
    let bate = false;
    if (regra.padrao_tipo === "substring") {
      bate = desc.includes(normalizarDescricao(regra.padrao));
    } else {
      try {
        bate = new RegExp(regra.padrao, "i").test(desc);
      } catch {
        bate = false;
      }
    }
    if (bate) {
      return {
        fornecedor_id: regra.aplica_fornecedor_id,
        cliente_id: null,
        centro_custo_id: regra.aplica_centro_custo_id,
        conta_contabil_id: regra.aplica_conta_contabil_id,
        fonte: "regra",
        motivo: `regra "${regra.nome}" (${regra.padrao_tipo})`,
        regra_id: regra.id,
      };
    }
  }

  return { fonte: "nenhum", motivo: "sem match" };
}

/** Carrega aliases + regras ativas da empresa em uma única chamada. */
export async function carregarRegrasEAliases(empresaId: string): Promise<{
  aliases: FinanceiroAlias[];
  regras: FinanceiroRegra[];
}> {
  const [aliasesRes, regrasRes] = await Promise.all([
    supabase
      .from("financeiro_aliases")
      .select("id, descricao_normalizada, fornecedor_id, cliente_id, centro_custo_id, conta_contabil_id, hits")
      .eq("empresa_id", empresaId),
    supabase
      .from("financeiro_regras")
      .select("id, nome, padrao_tipo, padrao, quando_tipo, prioridade, ativo, aplica_fornecedor_id, aplica_centro_custo_id, aplica_conta_contabil_id")
      .eq("empresa_id", empresaId)
      .eq("ativo", true),
  ]);

  if (aliasesRes.error) throw new Error(aliasesRes.error.message);
  if (regrasRes.error) throw new Error(regrasRes.error.message);

  return {
    aliases: (aliasesRes.data ?? []) as unknown as FinanceiroAlias[],
    regras: (regrasRes.data ?? []) as unknown as FinanceiroRegra[],
  };
}

/**
 * Registra (ou reforça) um alias após confirmação humana.
 *
 * Se já existir um alias para a mesma descrição normalizada, incrementa
 * `hits` e atualiza `ultima_confirmacao_em`. Caso contrário, cria.
 */
export async function confirmarAlias(params: {
  empresa_id: string;
  descricao: string;
  fornecedor_id?: string | null;
  cliente_id?: string | null;
  centro_custo_id?: string | null;
  conta_contabil_id?: string | null;
  usuario_id?: string | null;
}): Promise<void> {
  const desc = normalizarDescricao(params.descricao);
  if (!desc) return;

  const { data: existing } = await supabase
    .from("financeiro_aliases")
    .select("id, hits")
    .eq("empresa_id", params.empresa_id)
    .eq("descricao_normalizada", desc)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from("financeiro_aliases")
      .update({
        hits: (existing.hits ?? 0) + 1,
        ultima_confirmacao_em: new Date().toISOString(),
        fornecedor_id: params.fornecedor_id ?? undefined,
        cliente_id: params.cliente_id ?? undefined,
        centro_custo_id: params.centro_custo_id ?? undefined,
        conta_contabil_id: params.conta_contabil_id ?? undefined,
      })
      .eq("id", existing.id);
    return;
  }

  await supabase.from("financeiro_aliases").insert({
    empresa_id: params.empresa_id,
    descricao_normalizada: desc,
    fornecedor_id: params.fornecedor_id ?? null,
    cliente_id: params.cliente_id ?? null,
    centro_custo_id: params.centro_custo_id ?? null,
    conta_contabil_id: params.conta_contabil_id ?? null,
    hits: 1,
    ultima_confirmacao_em: new Date().toISOString(),
    criado_por: params.usuario_id ?? null,
  });
}