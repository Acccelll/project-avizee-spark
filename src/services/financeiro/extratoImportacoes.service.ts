/**
 * Serviço de persistência de transações de extrato bancário (OFX).
 *
 * Salva cada transação em `financeiro_extrato_importacoes` para que a
 * conciliação não perca trabalho ao recarregar a página e impede
 * re-importação duplicada via UNIQUE (conta, fitid).
 */
import { supabase } from "@/integrations/supabase/client";
import type { TransacaoExtrato } from "./ofxParser.service";
import { estornarBaixaFinanceira } from "./baixaRpc";

export type ExtratoStatus = "pendente" | "conciliado" | "ignorado";

/** Sprint 2 — cabeçalho de lote de importação. */
export interface LoteImportacao {
  id: string;
  conta_bancaria_id: string;
  arquivo_nome: string;
  arquivo_hash: string | null;
  origem: string;
  total_transacoes: number;
  inseridas: number;
  status: "ativo" | "arquivado";
  criado_por: string | null;
  created_at: string;
}

/**
 * Cria (ou reaproveita) um cabeçalho de lote para o arquivo importado.
 * Estratégia: se já existir um lote com o mesmo hash para a conta,
 * devolve o existente; caso contrário, insere um novo.
 */
export async function criarLoteImportacao(input: {
  empresaId: string;
  contaBancariaId: string;
  arquivoNome: string;
  arquivoHash?: string | null;
  origem?: "ofx" | "pdf_cartao" | "csv" | "manual";
  totalTransacoes: number;
  criadoPor?: string | null;
}): Promise<string> {
  if (input.arquivoHash) {
    const { data: existente } = await supabase
      .from("financeiro_extrato_lotes")
      .select("id")
      .eq("conta_bancaria_id", input.contaBancariaId)
      .eq("arquivo_hash", input.arquivoHash)
      .maybeSingle();
    if (existente?.id) return existente.id as string;
  }
  const { data, error } = await supabase
    .from("financeiro_extrato_lotes")
    .insert({
      empresa_id: input.empresaId,
      conta_bancaria_id: input.contaBancariaId,
      arquivo_nome: input.arquivoNome,
      arquivo_hash: input.arquivoHash ?? null,
      origem: input.origem ?? "ofx",
      total_transacoes: input.totalTransacoes,
      inseridas: 0,
      criado_por: input.criadoPor ?? null,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

/** Atualiza a contagem de inseridas em um lote. */
export async function atualizarLoteInseridas(loteId: string, inseridas: number): Promise<void> {
  const { error } = await supabase
    .from("financeiro_extrato_lotes")
    .update({ inseridas })
    .eq("id", loteId);
  if (error) throw new Error(error.message);
}

export interface LoteResumo extends LoteImportacao {
  conta_nome: string | null;
  banco_nome: string | null;
  conciliadas: number;
  pendentes: number;
}

/** Lista os lotes de importação com resumo de conciliação. */
export async function listarLotesImportacao(input?: {
  contaBancariaId?: string;
}): Promise<LoteResumo[]> {
  let query = supabase
    .from("financeiro_extrato_lotes" as never)
    .select(
      "id, conta_bancaria_id, arquivo_nome, arquivo_hash, origem, total_transacoes, inseridas, status, criado_por, created_at, " +
        "contas_bancarias(descricao, bancos(nome))",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (input?.contaBancariaId) query = (query as { eq: (c: string, v: string) => typeof query }).eq("conta_bancaria_id", input.contaBancariaId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const lotes = ((data as unknown) ?? []) as Array<LoteImportacao & { contas_bancarias?: { descricao: string; bancos?: { nome: string } | null } | null }>;
  if (lotes.length === 0) return [];
  // Conta conciliadas/pendentes por lote em uma segunda query agregada.
  const ids = lotes.map((l) => l.id);
  const { data: rows } = await supabase
    .from("financeiro_extrato_importacoes")
    .select("lote_id, status")
    .in("lote_id", ids as never);
  const agg = new Map<string, { conc: number; pend: number }>();
  ((rows ?? []) as Array<{ lote_id: string; status: string }>).forEach((r) => {
    const cur = agg.get(r.lote_id) ?? { conc: 0, pend: 0 };
    if (r.status === "conciliado") cur.conc++;
    else if (r.status === "pendente") cur.pend++;
    agg.set(r.lote_id, cur);
  });
  return lotes.map((l) => ({
    ...l,
    conta_nome: l.contas_bancarias?.descricao ?? null,
    banco_nome: l.contas_bancarias?.bancos?.nome ?? null,
    conciliadas: agg.get(l.id)?.conc ?? 0,
    pendentes: agg.get(l.id)?.pend ?? l.total_transacoes,
  }));
}

/** Exclui um lote (apenas se não houver linhas conciliadas). */
export async function excluirLoteImportacao(loteId: string): Promise<void> {
  const { count, error: cErr } = await supabase
    .from("financeiro_extrato_importacoes")
    .select("id", { count: "exact", head: true })
    .eq("lote_id", loteId)
    .eq("status", "conciliado");
  if (cErr) throw new Error(cErr.message);
  if ((count ?? 0) > 0) {
    throw new Error("Lote possui transações conciliadas — desfaça as conciliações antes de excluir.");
  }
  // Apaga as linhas pendentes do lote e depois o próprio lote.
  await supabase.from("financeiro_extrato_importacoes").delete().eq("lote_id", loteId);
  const { error } = await supabase.from("financeiro_extrato_lotes").delete().eq("id", loteId);
  if (error) throw new Error(error.message);
}

export interface ExtratoTransacaoPersistida {
  id: string;
  conta_bancaria_id: string;
  fitid: string;
  data: string;
  valor: number;
  descricao: string | null;
  status: ExtratoStatus;
  baixa_id: string | null;
  sugestao_lancamento_id: string | null;
  sugestao_score: number | null;
  sugestao_motivos: string[] | null;
  is_transferencia_interna: boolean | null;
  transferencia_par_id: string | null;
  favorecido: string | null;
  forma_pagamento: string | null;
  natureza: string | null;
}

/** Faz upsert de transações OFX (idempotente por (conta, fitid)). */
export async function persistirExtratoOFX(input: {
  contaBancariaId: string;
  empresaId?: string | null;
  arquivoHash?: string | null;
  loteId?: string | null;
  transacoes: TransacaoExtrato[];
}): Promise<{ inseridas: number }> {
  const { contaBancariaId, transacoes, arquivoHash } = input;
  if (!transacoes.length) return { inseridas: 0 };

  let empresaId = input.empresaId ?? null;
  if (!empresaId) {
    const { data: conta, error: contaError } = await supabase
      .from("contas_bancarias")
      .select("empresa_id")
      .eq("id", contaBancariaId)
      .maybeSingle();
    if (contaError) throw new Error(contaError.message);
    empresaId = conta?.empresa_id ?? null;
  }

  if (!empresaId) {
    throw new Error("Empresa da conta bancária não identificada para persistir o extrato.");
  }

  const rows = transacoes.map((t) => ({
    empresa_id: empresaId,
    conta_bancaria_id: contaBancariaId,
    fitid: t.id,
    data: t.data,
    valor: t.valor,
    descricao: t.descricao,
    arquivo_hash: arquivoHash ?? null,
    lote_id: input.loteId ?? null,
    status: "pendente" as ExtratoStatus,
  }));

  const { error, count } = await supabase
    .from("financeiro_extrato_importacoes")
    .upsert(rows as never, {
      onConflict: "conta_bancaria_id,fitid",
      ignoreDuplicates: true,
      count: "exact",
    });
  if (error) throw new Error(error.message);
  return { inseridas: count ?? 0 };
}

/** Lista transações persistidas de uma conta no período. */
export async function listarExtratoPersistido(input: {
  contaBancariaId: string;
  dataInicio: string;
  dataFim: string;
}): Promise<ExtratoTransacaoPersistida[]> {
  const { contaBancariaId, dataInicio, dataFim } = input;
  if (!contaBancariaId) return [];
  const { data, error } = await supabase
    .from("financeiro_extrato_importacoes")
    .select(
      "id, conta_bancaria_id, fitid, data, valor, descricao, status, baixa_id, " +
        "sugestao_lancamento_id, sugestao_score, sugestao_motivos, " +
        "is_transferencia_interna, transferencia_par_id, " +
        "favorecido, forma_pagamento, natureza",
    )
    .eq("conta_bancaria_id", contaBancariaId)
    .gte("data", dataInicio)
    .lte("data", dataFim)
    .order("data", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data as unknown) as ExtratoTransacaoPersistida[]) ?? [];
}

/**
 * Dada uma lista de baixa_ids, devolve o mapa baixa_id → lancamento_id
 * para permitir marcar lançamentos como conciliados na grade ERP a
 * partir das linhas de extrato já conciliadas.
 */
export async function mapBaixasParaLancamentos(
  baixaIds: string[],
): Promise<Map<string, string>> {
  const ids = baixaIds.filter((v): v is string => !!v);
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from("financeiro_baixas")
    .select("id, lancamento_id")
    .in("id", ids)
    .is("estornada_em", null);
  if (error) throw new Error(error.message);
  const map = new Map<string, string>();
  ((data ?? []) as Array<{ id: string; lancamento_id: string }>).forEach((r) => {
    map.set(r.id, r.lancamento_id);
  });
  return map;
}

/** Marca uma transação como conciliada (vinculada a uma baixa). */
export async function marcarExtratoConciliado(input: {
  extratoId: string;
  baixaId: string;
}): Promise<void> {
  const { error } = await supabase
    .from("financeiro_extrato_importacoes")
    .update({
      status: "conciliado",
      baixa_id: input.baixaId,
      sugestao_lancamento_id: null,
      sugestao_score: null,
      sugestao_motivos: null,
    })
    .eq("id", input.extratoId);
  if (error) throw new Error(error.message);
}

/** Marca uma transação persistida como conciliada usando a chave natural do OFX. */
export async function marcarExtratoConciliadoPorFitid(input: {
  contaBancariaId: string;
  fitid: string;
  baixaId: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from("financeiro_extrato_importacoes")
    .update({
      status: "conciliado",
      baixa_id: input.baixaId,
      sugestao_lancamento_id: null,
      sugestao_score: null,
      sugestao_motivos: null,
    })
    .eq("conta_bancaria_id", input.contaBancariaId)
    .eq("fitid", input.fitid);
  if (error) throw new Error(error.message);
}

/** Remove a sugestão materializada de uma linha de extrato sem alterar o status. */
export async function limparSugestaoExtrato(extratoId: string): Promise<void> {
  const { error } = await supabase
    .from("financeiro_extrato_importacoes")
    .update({
      sugestao_lancamento_id: null,
      sugestao_score: null,
      sugestao_motivos: null,
    })
    .eq("id", extratoId);
  if (error) throw new Error(error.message);
}

/** Marca uma transação como ignorada (não conciliar). */
export async function ignorarExtrato(extratoId: string): Promise<void> {
  const { error } = await supabase
    .from("financeiro_extrato_importacoes")
    .update({
      status: "ignorado",
      baixa_id: null,
      sugestao_lancamento_id: null,
      sugestao_score: null,
      sugestao_motivos: null,
    })
    .eq("id", extratoId);
  if (error) throw new Error(error.message);
}

/**
 * Exclui linhas de extrato importadas (apenas as ainda pendentes) de
 * uma conta bancária, identificadas pelo fitid natural do OFX.
 * Linhas já conciliadas (com baixa vinculada) são preservadas para
 * manter a rastreabilidade contábil — o usuário deve desfazer a
 * conciliação antes de excluir.
 */
export async function excluirExtratosPorFitids(input: {
  contaBancariaId: string;
  fitids: string[];
}): Promise<{ excluidas: number }> {
  if (!input.fitids.length) return { excluidas: 0 };
  const { error, count } = await supabase
    .from("financeiro_extrato_importacoes")
    .delete({ count: "exact" })
    .eq("conta_bancaria_id", input.contaBancariaId)
    .in("fitid", input.fitids)
    .eq("status", "pendente");
  if (error) throw new Error(error.message);
  return { excluidas: count ?? 0 };
}

/**
 * Onda 10 — Desfaz uma conciliação já persistida: estorna a baixa
 * financeira vinculada e reabre a linha do extrato (status → pendente,
 * baixa_id → null). Se `baixaId` não for informado, apenas reabre o
 * extrato (usado quando a baixa já foi estornada por outro fluxo).
 */
export async function desfazerConciliacaoExtrato(input: {
  extratoPersistidoId: string;
  baixaId?: string | null;
  motivo?: string;
}): Promise<void> {
  if (input.baixaId) {
    try {
      await estornarBaixaFinanceira({
        baixaId: input.baixaId,
        motivo: input.motivo ?? "Conciliação bancária desfeita pelo usuário.",
      });
    } catch (err) {
      // Se a baixa já estava estornada, prossegue apenas reabrindo o extrato.
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      if (!msg.includes("estorn") && !msg.includes("not found")) throw err;
    }
  }
  const { error } = await supabase
    .from("financeiro_extrato_importacoes")
    .update({ status: "pendente", baixa_id: null })
    .eq("id", input.extratoPersistidoId);
  if (error) throw new Error(error.message);
}