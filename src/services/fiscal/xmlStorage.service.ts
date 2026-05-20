/**
 * Arquivamento de XMLs fiscais no bucket `dbavizee` (prefixo `fiscal/`).
 *
 * Convenções:
 * - Caminho canônico: `fiscal/{YYYY}/{MM}/{tipo}/{chave}.xml`
 * - `upsert: true` para idempotência (mesma chave → mesmo arquivo).
 * - Falha de upload NÃO interrompe importação; o caller registra warning.
 *
 * Ver mem://features/faturamento-fiscal.
 */
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "dbavizee";

function buildPath(input: {
  chave: string;
  tipo: "entrada" | "saida";
  dataEmissao?: string | null;
}): string {
  const safeChave = (input.chave || "sem-chave").replace(/\D/g, "") || `sem-chave-${Date.now()}`;
  const ref = input.dataEmissao ? new Date(input.dataEmissao) : new Date();
  const ano = (isNaN(ref.getTime()) ? new Date() : ref).getFullYear();
  const mes = String((isNaN(ref.getTime()) ? new Date() : ref).getMonth() + 1).padStart(2, "0");
  return `fiscal/${ano}/${mes}/${input.tipo}/${safeChave}.xml`;
}

/** Faz upload (idempotente) do XML e devolve o path final no bucket. */
export async function uploadNfeXml(input: {
  chave: string;
  tipo: "entrada" | "saida";
  xmlText: string;
  dataEmissao?: string | null;
}): Promise<{ path: string }> {
  const path = buildPath(input);
  const blob = new Blob([input.xmlText], { type: "application/xml" });
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    upsert: true,
    contentType: "application/xml",
    cacheControl: "3600",
  });
  if (error) throw new Error(error.message);
  return { path };
}

/** Gera signed URL temporária (5 min) para download do XML arquivado. */
export async function getNfeXmlSignedUrl(path: string, expiresInSec = 300): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSec);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

/** Baixa o XML arquivado como Blob (para botão "Baixar XML"). */
export async function downloadNfeXml(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw new Error(error.message);
  return data;
}

/** Dispara download no browser (cria <a> temporário). */
export async function triggerDownloadNfeXml(input: {
  path: string;
  filename?: string;
}): Promise<void> {
  const blob = await downloadNfeXml(input.path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = input.filename || input.path.split("/").pop() || "nfe.xml";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}