/**
 * Serviço de sugestão automática de tributação fiscal.
 *
 * Retorna alíquotas sugeridas com base no NCM, CFOP, UFs e regime tributário.
 * Em produção, esse serviço consultaria uma tabela de regras fiscais ou API externa.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type RegimeTributario = "simples_nacional" | "lucro_presumido" | "lucro_real";

export interface SugestaoTributacaoParams {
  ncm: string;
  cfop: string;
  ufOrigem: string;
  ufDestino: string;
  regimeTributario: RegimeTributario;
}

export interface SugestaoTributacao {
  icmsAliquota: number;
  icmsCst: string;
  ipiAliquota: number;
  pisAliquota: number;
  cofinAliquota: number;
}

/** Verifica se a operação é interestadual */
function isInterestadual(ufOrigem: string, ufDestino: string): boolean {
  return ufOrigem.toUpperCase() !== ufDestino.toUpperCase();
}

/** Verifica se o CFOP é de saída */
function isSaida(cfop: string): boolean {
  return cfop.startsWith("5") || cfop.startsWith("6") || cfop.startsWith("7");
}

/**
 * Sugere alíquota de IPI com base no capítulo NCM.
 *
 * IMPORTANTE: estes valores são apenas SUGESTÕES típicas baseadas no
 * capítulo (2 primeiros dígitos do NCM). A TIPI completa tem milhares
 * de exceções por código específico — o usuário/contador deve sempre
 * confirmar a alíquota correta para cada produto.
 */
function sugerirAliquotaIpi(ncm: string): number {
  const cap = (ncm ?? "").slice(0, 2);
  const tabelaIpi: Record<string, number> = {
    "22": 20, // Bebidas
    "24": 300, // Tabaco e derivados
    "33": 7,  // Cosméticos e perfumaria
    "84": 5,  // Máquinas e aparelhos mecânicos
    "85": 10, // Máquinas e aparelhos elétricos
    "87": 25, // Veículos automotores
    "90": 5,  // Instrumentos de precisão
  };
  return tabelaIpi[cap] ?? 0;
}

/**
 * Retorna alíquotas sugeridas de tributação com base nos parâmetros fornecidos.
 * Regras simplificadas — em produção devem ser complementadas por tabela de NCM/CFOP.
 */
export function sugerirTributacao(params: SugestaoTributacaoParams): SugestaoTributacao {
  const { cfop, ufOrigem, ufDestino, regimeTributario } = params;
  const interestadual = isInterestadual(ufOrigem, ufDestino);
  const saida = isSaida(cfop);

  // Alíquota ICMS
  let icmsAliquota = 0;
  let icmsCst = "00";

  if (regimeTributario === "simples_nacional") {
    icmsCst = "400";
    icmsAliquota = 0; // Simples Nacional: tributado pelo PGDAS, não destacado na NF-e
  } else if (saida) {
    if (interestadual) {
      // Alíquota interestadual padrão (Sul/Sudeste → outras regiões = 12%, demais = 7%)
      const regioesSulSudeste = ["SP", "RJ", "MG", "ES", "PR", "SC", "RS"];
      icmsAliquota = regioesSulSudeste.includes(ufOrigem.toUpperCase()) ? 12 : 7;
    } else {
      icmsAliquota = 18; // Alíquota interna padrão (varia por UF e produto)
    }
    icmsCst = "00";
  }

  // Alíquotas PIS/COFINS
  let pisAliquota = 0;
  let cofinAliquota = 0;

  if (regimeTributario === "lucro_real") {
    pisAliquota = 1.65;
    cofinAliquota = 7.6;
  } else if (regimeTributario === "lucro_presumido") {
    pisAliquota = 0.65;
    cofinAliquota = 3.0;
  }
  // Simples Nacional: PIS/COFINS incluídos no DAS, alíquota 0 na NF-e

  // IPI: sugestão por capítulo NCM (apenas para operações de saída).
  // Valores são aproximações típicas — o contador deve confirmar.
  const ipiAliquota = saida ? sugerirAliquotaIpi(params.ncm) : 0;

  return {
    icmsAliquota,
    icmsCst,
    ipiAliquota,
    pisAliquota,
    cofinAliquota,
  };
}

// ───────────────────────── Matriz Fiscal & Naturezas ──────────────────────────

type NaturezaInsert = Database["public"]["Tables"]["naturezas_operacao"]["Insert"];
type NaturezaUpdate = Database["public"]["Tables"]["naturezas_operacao"]["Update"];
type MatrizFiscalInsert = Database["public"]["Tables"]["matriz_fiscal"]["Insert"];
type MatrizFiscalUpdate = Database["public"]["Tables"]["matriz_fiscal"]["Update"];

export interface AplicarMatrizParams {
  produtoId: string;
  ufDestino: string;
  tipoOperacao: "saida" | "entrada";
}

export interface MatrizFiscalResult {
  matched?: boolean;
  cfop?: string;
  cst_csosn?: string;
  origem_mercadoria?: string;
  aliquota_icms?: number;
  aliquota_pis?: number;
  aliquota_cofins?: number;
  aliquota_ipi?: number;
  matriz_nome?: string;
}

/** Aplica a matriz fiscal ao produto/UF/tipo. Wrappa `aplicar_matriz_fiscal`. */
export async function aplicarMatrizFiscal(
  params: AplicarMatrizParams,
): Promise<MatrizFiscalResult> {
  const { data, error } = await supabase.rpc("aplicar_matriz_fiscal", {
    p_produto_id: params.produtoId,
    p_uf_destino: params.ufDestino,
    p_tipo_operacao: params.tipoOperacao,
  });
  if (error) throw error;
  return (data ?? {}) as MatrizFiscalResult;
}

/** Cria ou atualiza uma natureza de operação. */
export async function saveNaturezaOperacao(
  payload: NaturezaInsert | NaturezaUpdate,
  editingId?: string,
): Promise<void> {
  if (editingId) {
    const { error } = await supabase
      .from("naturezas_operacao")
      .update(payload as NaturezaUpdate)
      .eq("id", editingId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("naturezas_operacao")
    .insert([payload as NaturezaInsert]);
  if (error) throw error;
}

export async function deleteNaturezaOperacao(id: string): Promise<void> {
  const { error } = await supabase.from("naturezas_operacao").delete().eq("id", id);
  if (error) throw error;
}

/** Cria ou atualiza uma regra da matriz fiscal. */
export async function saveMatrizRegra(
  payload: MatrizFiscalInsert | MatrizFiscalUpdate,
  editingId?: string,
): Promise<void> {
  if (editingId) {
    const { error } = await supabase
      .from("matriz_fiscal")
      .update(payload as MatrizFiscalUpdate)
      .eq("id", editingId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("matriz_fiscal")
    .insert([payload as MatrizFiscalInsert]);
  if (error) throw error;
}

export async function deleteMatrizRegra(id: string): Promise<void> {
  const { error } = await supabase.from("matriz_fiscal").delete().eq("id", id);
  if (error) throw error;
}
