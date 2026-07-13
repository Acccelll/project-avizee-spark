/**
 * Importação em lote de faturas de cartão (PDF).
 * Parse → import (RPC existente) → auto-match com financeiro_lancamentos →
 * registro de lote para undo em bloco.
 */
import { supabase } from "@/integrations/supabase/client";
import { parseFaturaPdf } from "./faturaParser";
import { importarFaturaCartao } from "./importService";
import type { EmissorCartao, FaturaImportInput } from "./types";

export interface LotePreviewItem {
  file: File;
  parsed?: FaturaImportInput;
  cartao_id?: string;
  cartao_nome?: string;
  ja_existe?: boolean;
  erro?: string;
}

export interface LoteFaturaResultado {
  arquivo: string;
  emissor: EmissorCartao;
  competencia: string;
  fatura_id: string;
  inseridas: number;
  duplicadas: number;
  vinculadas: number;
  criou_fatura: boolean;
}

export interface LoteResultado {
  lote_id: string;
  faturas: LoteFaturaResultado[];
  total_vinculadas: number;
  total_linhas: number;
}

interface CartaoInfo { id: string; ultimos4: string | null; banco_nome: string | null }

export async function resolverCartaoPorEmissor(emissor: EmissorCartao): Promise<CartaoInfo | null> {
  const { data, error } = await supabase
    .from("cartoes_credito")
    .select("id, ultimos4, bancos(nome)")
    .eq("ativo", true);
  if (error) throw error;
  const alvo = { c6: /c6/i, inter: /inter/i, recargapay: /recarga/i }[emissor];
  const match = (data ?? []).find((c) => {
    const banco = (c as { bancos: { nome?: string } | null }).bancos?.nome ?? "";
    return alvo.test(banco);
  });
  if (!match) return null;
  return {
    id: match.id,
    ultimos4: match.ultimos4,
    banco_nome: (match as { bancos: { nome?: string } | null }).bancos?.nome ?? null,
  };
}

export async function preverFatura(file: File): Promise<LotePreviewItem> {
  try {
    const parsed = await parseFaturaPdf(file);
    const cartao = await resolverCartaoPorEmissor(parsed.emissor);
    if (!cartao) return { file, parsed, erro: `Sem cartão cadastrado para ${parsed.emissor.toUpperCase()}` };
    const { data: existente } = await supabase
      .from("cartao_faturas")
      .select("id")
      .eq("cartao_id", cartao.id)
      .eq("competencia", parsed.competencia)
      .maybeSingle();
    return {
      file,
      parsed,
      cartao_id: cartao.id,
      cartao_nome: cartao.banco_nome ?? undefined,
      ja_existe: !!existente,
    };
  } catch (err) {
    return { file, erro: err instanceof Error ? err.message : "Falha ao ler PDF" };
  }
}

/** Busca um único candidato exato (valor ±0.01, data ±5d) para auto-vincular. */
export async function autoCandidato(params: {
  empresa_id: string;
  cartao_id: string;
  valor: number;
  data: string;
}): Promise<string | null> {
  const d = new Date(`${params.data}T00:00:00Z`);
  const min = new Date(d); min.setUTCDate(min.getUTCDate() - 5);
  const max = new Date(d); max.setUTCDate(max.getUTCDate() + 5);
  const v = Math.abs(params.valor);
  const { data, error } = await supabase
    .from("financeiro_lancamentos")
    .select("id")
    .eq("empresa_id", params.empresa_id)
    .eq("tipo", "pagar")
    .eq("ativo", true)
    .is("cartao_fatura_id", null)
    .gte("data_vencimento", min.toISOString().slice(0, 10))
    .lte("data_vencimento", max.toISOString().slice(0, 10))
    .gte("valor", v - 0.01)
    .lte("valor", v + 0.01)
    .limit(2);
  if (error) throw error;
  if (!data || data.length !== 1) return null;
  return data[0].id;
}

export async function executarLote(params: {
  empresa_id: string;
  itens: LotePreviewItem[];
}): Promise<LoteResultado> {
  const faturas: LoteFaturaResultado[] = [];
  const vinculos: { linha_id: string; lancamento_id: string; fatura_id: string }[] = [];
  const criadas: string[] = [];
  const atualizadas: string[] = [];

  for (const item of params.itens) {
    if (!item.parsed || !item.cartao_id || item.erro) continue;

    const res = await importarFaturaCartao({
      ...item.parsed,
      empresa_id: params.empresa_id,
      cartao_id: item.cartao_id,
    });

    if (item.ja_existe) atualizadas.push(res.fatura_id);
    else criadas.push(res.fatura_id);

    // Busca as linhas pendentes desta fatura e tenta auto-vincular
    const { data: linhas } = await supabase
      .from("cartao_fatura_lancamentos")
      .select("id, valor, data_compra, status")
      .eq("cartao_fatura_id", res.fatura_id)
      .eq("status", "pendente");

    let vinc = 0;
    for (const l of linhas ?? []) {
      const cand = await autoCandidato({
        empresa_id: params.empresa_id,
        cartao_id: item.cartao_id,
        valor: Number(l.valor),
        data: l.data_compra as string,
      });
      if (!cand) continue;
      const { error: e1 } = await supabase
        .from("cartao_fatura_lancamentos")
        .update({ lancamento_id: cand, status: "aceito" })
        .eq("id", l.id)
        .is("lancamento_id", null);
      if (e1) continue;
      const { error: e2 } = await supabase
        .from("financeiro_lancamentos")
        .update({ cartao_fatura_id: res.fatura_id })
        .eq("id", cand)
        .is("cartao_fatura_id", null);
      if (e2) continue;
      vinculos.push({ linha_id: l.id, lancamento_id: cand, fatura_id: res.fatura_id });
      vinc++;
    }

    faturas.push({
      arquivo: item.file.name,
      emissor: item.parsed.emissor,
      competencia: item.parsed.competencia,
      fatura_id: res.fatura_id,
      inseridas: res.inseridas,
      duplicadas: res.duplicadas,
      vinculadas: vinc,
      criou_fatura: !item.ja_existe,
    });
  }

  const total_vinculadas = faturas.reduce((s, f) => s + f.vinculadas, 0);
  const total_linhas = faturas.reduce((s, f) => s + f.inseridas + f.duplicadas, 0);

  const { data: loteId, error } = await supabase.rpc("cartao_importacao_registrar_lote", {
    p_faturas_criadas: criadas,
    p_faturas_atualizadas: atualizadas,
    p_vinculos: vinculos as unknown as never,
    p_resumo: { faturas, total_vinculadas, total_linhas } as unknown as never,
  });
  if (error) throw error;

  return { lote_id: loteId as string, faturas, total_vinculadas, total_linhas };
}

export async function desfazerLote(loteId: string): Promise<void> {
  const { error } = await supabase.rpc("cartao_importacao_desfazer", { p_lote: loteId });
  if (error) throw error;
}

export interface LoteResumoRow {
  id: string;
  created_at: string;
  desfeito_em: string | null;
  resumo: {
    faturas?: LoteFaturaResultado[];
    total_vinculadas?: number;
    total_linhas?: number;
  } | null;
  faturas_criadas: string[];
}

export async function listarLotes(): Promise<LoteResumoRow[]> {
  const { data, error } = await supabase
    .from("cartao_importacao_lotes")
    .select("id, created_at, desfeito_em, resumo, faturas_criadas")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as unknown as LoteResumoRow[];
}