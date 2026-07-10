/**
 * Orquestrador do Motor Universal de Importação (Épico F —
 * Financeiro Inteligente 2.0).
 *
 * Fluxo:
 *   1) detecta origem (OFX/PDF/CSV) pelo mime/extensão.
 *   2) chama o adapter e obtém `StagedTx[]`.
 *   3) grava um `financeiro_importacoes_docs` com o resumo.
 *   4) faz upsert em `financeiro_extrato_importacoes` (idempotente por
 *      conta_bancaria_id + fitid), anotando `origem` e
 *      `documento_importacao_id`.
 *   5) aplica o motor de aliases/regras (Épico B) e grava
 *      `sugestao_score`/`sugestao_motivos` quando houver match.
 *
 * Não concilia nada — só posiciona candidatos para o usuário confirmar.
 */

import { supabase } from "@/integrations/supabase/client";
import { adaptOFX } from "./adapters/ofx";
import { adaptCSV } from "./adapters/csv";
import { adaptPDF } from "./adapters/pdf";
import { aplicarRegrasEAliases, carregarRegrasEAliases } from "../matching/rulesEngine.service";
import type { ImportacaoDocumentoResumo, OrigemImportacao, StagedTx } from "./types";

function detectarOrigem(file: File): OrigemImportacao {
  const nome = file.name.toLowerCase();
  if (nome.endsWith(".ofx") || nome.endsWith(".qfx")) return "OFX";
  if (nome.endsWith(".csv")) return "CSV";
  if (nome.endsWith(".pdf")) return "PDF";
  if (file.type === "application/pdf") return "PDF";
  if (file.type.includes("csv")) return "CSV";
  return "OFX";
}

async function hashArquivo(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function importarDocumentoUniversal(input: {
  file: File;
  empresa_id: string;
  conta_bancaria_id: string;
  cartao_id?: string | null;
}): Promise<ImportacaoDocumentoResumo> {
  const origem = detectarOrigem(input.file);

  // 1) adapter → StagedTx[]
  let staged: StagedTx[] = [];
  let rawTexto: string | null = null;
  if (origem === "OFX") {
    rawTexto = await input.file.text();
    staged = adaptOFX(rawTexto);
  } else if (origem === "CSV") {
    rawTexto = await input.file.text();
    staged = adaptCSV(rawTexto);
  } else {
    staged = await adaptPDF(input.file);
  }

  // 2) header em financeiro_importacoes_docs
  const arquivoHash = rawTexto ? await hashArquivo(rawTexto) : null;
  const datas = staged.map((s) => s.data).sort();
  const { data: userRes } = await supabase.auth.getUser();
  const importadoPor = userRes?.user?.id ?? null;

  const { data: docRow, error: docErr } = await supabase
    .from("financeiro_importacoes_docs")
    .insert({
      empresa_id: input.empresa_id,
      origem,
      arquivo_nome: input.file.name,
      arquivo_hash: arquivoHash,
      conta_bancaria_id: input.conta_bancaria_id,
      cartao_id: input.cartao_id ?? null,
      total_transacoes: staged.length,
      periodo_inicio: datas[0] ?? null,
      periodo_fim: datas[datas.length - 1] ?? null,
      status: "processando",
      importado_por: importadoPor,
      raw_texto: rawTexto,
    })
    .select("id")
    .single();
  if (docErr) throw new Error(docErr.message);

  // 3) motor de regras + aliases
  const { aliases, regras } = await carregarRegrasEAliases(input.empresa_id).catch(() => ({
    aliases: [],
    regras: [],
  }));

  // 4) upsert em financeiro_extrato_importacoes com sugestões
  const rows = staged.map((s) => {
    const hint = aplicarRegrasEAliases({
      descricao: s.descricao,
      tipo: s.tipo === "C" ? "credito" : "debito",
      aliases,
      regras,
    });
    const motivos = hint.fonte === "nenhum" ? null : [hint.motivo];
    const score = hint.fonte === "alias" ? 0.9 : hint.fonte === "regra" ? 0.7 : null;
    return {
      conta_bancaria_id: input.conta_bancaria_id,
      fitid: s.id,
      data: s.data,
      valor: s.valor,
      descricao: s.descricao,
      arquivo_hash: arquivoHash,
      status: "pendente",
      origem,
      documento_importacao_id: docRow.id,
      sugestao_score: score,
      sugestao_motivos: motivos,
    };
  });

  const { error: upErr, count } = await supabase
    .from("financeiro_extrato_importacoes")
    .upsert(rows as never, {
      onConflict: "conta_bancaria_id,fitid",
      ignoreDuplicates: true,
      count: "exact",
    });
  if (upErr) throw new Error(upErr.message);

  const comSugestao = rows.filter((r) => r.sugestao_score !== null).length;

  // 5) atualiza status do documento
  await supabase
    .from("financeiro_importacoes_docs")
    .update({ status: "processado" })
    .eq("id", docRow.id);

  return {
    documento_id: docRow.id,
    origem,
    total: staged.length,
    inseridas: count ?? 0,
    com_sugestao: comSugestao,
  };
}