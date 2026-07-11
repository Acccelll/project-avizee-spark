/**
 * Serviço base de importação de extratos da Conciliação v2.
 *
 * Responsável apenas pela fundação de importação: hash, deduplicação,
 * persistência do arquivo lógico e inserção em lote das linhas normalizadas.
 * Parsing específico de OFX/CNAB/CSV e matching ficam em serviços posteriores.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { logger } from "@/lib/logger";
import type {
  ConciliacaoExtrato,
  ConciliacaoExtratoInsert,
  ConciliacaoExtratoLinha,
  ConciliacaoExtratoLinhaInsert,
  ConciliacaoFormatoExtrato,
  ConciliacaoOrigemExtrato,
  ConciliacaoStatusExtrato,
  ConciliacaoStatusLinha,
  ConciliacaoTipoMovimento,
} from "@/types/domain";

const DEFAULT_CHUNK_SIZE = 500;

type JsonObject = Record<string, Json | undefined>;

export interface LinhaExtratoNormalizadaInput {
  fitid?: string | null;
  data_movimento: string;
  valor: number;
  descricao: string;
  documento?: string | null;
  contraparte_nome?: string | null;
  contraparte_documento?: string | null;
  saldo_apos?: number | null;
  status?: ConciliacaoStatusLinha;
  metadados?: JsonObject;
}

export interface CriarExtratoInput {
  empresa_id: string;
  conta_bancaria_id: string;
  arquivo_hash: string;
  arquivo_nome?: string | null;
  formato?: ConciliacaoFormatoExtrato;
  origem?: ConciliacaoOrigemExtrato;
  status?: ConciliacaoStatusExtrato;
  periodo_inicio?: string | null;
  periodo_fim?: string | null;
  total_linhas?: number;
  total_creditos?: number;
  total_debitos?: number;
  metadados?: JsonObject;
}

export interface RegistrarExtratoInput extends Omit<CriarExtratoInput, "total_linhas" | "total_creditos" | "total_debitos"> {
  linhas: LinhaExtratoNormalizadaInput[];
  chunkSize?: number;
}

export interface RegistrarExtratoResult {
  extrato: ConciliacaoExtrato;
  linhas: ConciliacaoExtratoLinha[];
}

function asJsonObject(value?: JsonObject): Json {
  return (value ?? {}) as Json;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function inferTipoMovimento(valor: number): ConciliacaoTipoMovimento {
  if (valor === 0) throw new Error("Linha de extrato com valor zero não é válida para conciliação.");
  return valor > 0 ? "credito" : "debito";
}

function buildLinhaHashPayload(input: {
  empresa_id: string;
  conta_bancaria_id: string;
  fitid?: string | null;
  data_movimento: string;
  valor: number;
  descricao: string;
  documento?: string | null;
}): string {
  return [
    input.empresa_id,
    input.conta_bancaria_id,
    input.fitid ?? "",
    input.data_movimento,
    input.valor.toFixed(2),
    normalizeText(input.descricao),
    normalizeText(input.documento),
  ].join("|");
}

export async function sha256Hex(value: string | Blob | ArrayBuffer): Promise<string> {
  const buffer = typeof value === "string"
    ? new TextEncoder().encode(value)
    : value instanceof Blob
      ? await value.arrayBuffer()
      : value;
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function calcularHashLinha(input: {
  empresa_id: string;
  conta_bancaria_id: string;
  fitid?: string | null;
  data_movimento: string;
  valor: number;
  descricao: string;
  documento?: string | null;
}): Promise<string> {
  return sha256Hex(buildLinhaHashPayload(input));
}

export async function buscarExtratoPorHash(input: {
  empresa_id: string;
  conta_bancaria_id: string;
  arquivo_hash: string;
}): Promise<ConciliacaoExtrato | null> {
  const { data, error } = await supabase
    .from("conciliacao_extratos")
    .select("*")
    .eq("empresa_id", input.empresa_id)
    .eq("conta_bancaria_id", input.conta_bancaria_id)
    .eq("arquivo_hash", input.arquivo_hash)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as ConciliacaoExtrato | null;
}

export async function criarExtrato(input: CriarExtratoInput): Promise<ConciliacaoExtrato> {
  const existente = await buscarExtratoPorHash({
    empresa_id: input.empresa_id,
    conta_bancaria_id: input.conta_bancaria_id,
    arquivo_hash: input.arquivo_hash,
  });
  if (existente) return existente;

  const payload: ConciliacaoExtratoInsert = {
    empresa_id: input.empresa_id,
    conta_bancaria_id: input.conta_bancaria_id,
    arquivo_hash: input.arquivo_hash,
    arquivo_nome: input.arquivo_nome ?? null,
    formato: input.formato ?? "ofx",
    origem: input.origem ?? "upload",
    status: input.status ?? "recebido",
    periodo_inicio: input.periodo_inicio ?? null,
    periodo_fim: input.periodo_fim ?? null,
    total_linhas: input.total_linhas ?? 0,
    total_creditos: input.total_creditos ?? 0,
    total_debitos: input.total_debitos ?? 0,
    metadados: asJsonObject(input.metadados),
  };

  const { data, error } = await supabase
    .from("conciliacao_extratos")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  logger.info("conciliacao.importacao.extrato_criado", { extrato_id: data.id, empresa_id: input.empresa_id });
  return data as ConciliacaoExtrato;
}

export async function inserirLinhasExtrato(input: {
  extrato: Pick<ConciliacaoExtrato, "id" | "empresa_id" | "conta_bancaria_id">;
  linhas: LinhaExtratoNormalizadaInput[];
  chunkSize?: number;
}): Promise<ConciliacaoExtratoLinha[]> {
  if (input.linhas.length === 0) return [];

  const rows: ConciliacaoExtratoLinhaInsert[] = await Promise.all(
    input.linhas.map(async (linha) => ({
      extrato_id: input.extrato.id,
      empresa_id: input.extrato.empresa_id,
      conta_bancaria_id: input.extrato.conta_bancaria_id,
      fitid: linha.fitid ?? null,
      hash_linha: await calcularHashLinha({
        empresa_id: input.extrato.empresa_id,
        conta_bancaria_id: input.extrato.conta_bancaria_id,
        fitid: linha.fitid ?? null,
        data_movimento: linha.data_movimento,
        valor: linha.valor,
        descricao: linha.descricao,
        documento: linha.documento ?? null,
      }),
      data_movimento: linha.data_movimento,
      valor: linha.valor,
      tipo_movimento: inferTipoMovimento(linha.valor),
      descricao: linha.descricao,
      documento: linha.documento ?? null,
      contraparte_nome: linha.contraparte_nome ?? null,
      contraparte_documento: linha.contraparte_documento ?? null,
      saldo_apos: linha.saldo_apos ?? null,
      status: linha.status ?? "pendente",
      metadados: asJsonObject(linha.metadados),
    })),
  );

  const created: ConciliacaoExtratoLinha[] = [];
  const chunkSize = input.chunkSize ?? DEFAULT_CHUNK_SIZE;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("conciliacao_extrato_linhas")
      .upsert(chunk, { onConflict: "empresa_id,conta_bancaria_id,hash_linha", ignoreDuplicates: true })
      .select("*");
    if (error) throw error;
    created.push(...((data ?? []) as ConciliacaoExtratoLinha[]));
  }

  logger.info("conciliacao.importacao.linhas_inseridas", {
    extrato_id: input.extrato.id,
    linhas_recebidas: input.linhas.length,
    linhas_inseridas: created.length,
  });
  return created;
}

export async function atualizarStatusExtrato(
  extratoId: string,
  status: ConciliacaoStatusExtrato,
  extra: Partial<Pick<ConciliacaoExtratoInsert, "total_linhas" | "total_creditos" | "total_debitos" | "periodo_inicio" | "periodo_fim">> = {},
): Promise<void> {
  const { error } = await supabase
    .from("conciliacao_extratos")
    .update({ status, ...extra })
    .eq("id", extratoId);
  if (error) throw error;
}

export async function registrarExtratoComLinhas(input: RegistrarExtratoInput): Promise<RegistrarExtratoResult> {
  const totalCreditos = input.linhas
    .filter((linha) => linha.valor > 0)
    .reduce((sum, linha) => sum + linha.valor, 0);
  const totalDebitos = Math.abs(
    input.linhas
      .filter((linha) => linha.valor < 0)
      .reduce((sum, linha) => sum + linha.valor, 0),
  );

  const extrato = await criarExtrato({
    ...input,
    status: input.status ?? "processando",
    total_linhas: input.linhas.length,
    total_creditos: totalCreditos,
    total_debitos: totalDebitos,
  });

  try {
    const linhas = await inserirLinhasExtrato({ extrato, linhas: input.linhas, chunkSize: input.chunkSize });
    await atualizarStatusExtrato(extrato.id, "processado", {
      total_linhas: input.linhas.length,
      total_creditos: totalCreditos,
      total_debitos: totalDebitos,
    });
    return { extrato: { ...extrato, status: "processado" }, linhas };
  } catch (error) {
    logger.warn("conciliacao.importacao.falha", { extrato_id: extrato.id, message: error instanceof Error ? error.message : "erro" });
    await atualizarStatusExtrato(extrato.id, "processado_com_erro");
    throw error;
  }
}