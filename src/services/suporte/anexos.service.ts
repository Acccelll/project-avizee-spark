import { supabase } from "@/integrations/supabase/client";
import type { SuporteAnexo } from "./types";

const BUCKET = "suporte";

/** Limites da seção 7 / Parte IV item 2 da especificação. */
export const SUPORTE_ANEXO_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const SUPORTE_ANEXO_MAX_POR_CHAMADO = 10;

/** ZIP explicitamente fora da lista (Parte IV item 1 — não incluído em V1). */
const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
  "application/xml",
  "text/xml",
  "text/plain",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export class SuporteAnexoValidationError extends Error {}

function sanitizeFileName(name: string): string {
  return name.normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(-120);
}

export async function listAnexos(chamadoId: string): Promise<SuporteAnexo[]> {
  const { data, error } = await supabase
    .from("suporte_anexos")
    .select("*")
    .eq("chamado_id", chamadoId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export interface UploadAnexoInput {
  chamadoId: string;
  file: File;
  eventoId?: string;
  isScreenshot?: boolean;
  anexosExistentes?: number;
}

/**
 * Faz upload ao bucket `suporte` e só então insere a linha em
 * `suporte_anexos` — nessa ordem, para que a policy de Storage já encontre
 * o `chamado_id` válido (especificação, item III.10).
 */
export async function uploadAnexo(input: UploadAnexoInput): Promise<SuporteAnexo> {
  const { chamadoId, file, eventoId, isScreenshot = false, anexosExistentes = 0 } = input;

  if (anexosExistentes >= SUPORTE_ANEXO_MAX_POR_CHAMADO) {
    throw new SuporteAnexoValidationError(
      `Este chamado já tem o máximo de ${SUPORTE_ANEXO_MAX_POR_CHAMADO} anexos.`,
    );
  }
  if (file.size > SUPORTE_ANEXO_MAX_BYTES) {
    throw new SuporteAnexoValidationError("Arquivo maior que 10 MB.");
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new SuporteAnexoValidationError(
      "Formato não suportado. Use PNG, JPG, WEBP, PDF, XML, TXT, CSV ou XLS/XLSX.",
    );
  }

  const { data: userData } = await supabase.auth.getUser();
  const uploadedBy = userData.user?.id;
  if (!uploadedBy) throw new Error("Usuário não autenticado.");

  const anexoId = crypto.randomUUID();
  const path = `${chamadoId}/${anexoId}-${sanitizeFileName(file.name)}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("suporte_anexos")
    .insert({
      id: anexoId,
      chamado_id: chamadoId,
      evento_id: eventoId ?? null,
      nome_arquivo: file.name,
      tipo_arquivo: file.type,
      caminho_storage: path,
      tamanho: file.size,
      is_screenshot: isScreenshot,
      uploaded_by: uploadedBy,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getAnexoUrl(caminhoStorage: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(caminhoStorage, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}
