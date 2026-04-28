/**
 * Wrappers em torno de `supabase.storage` para a camada de UI não tocar
 * o cliente diretamente. Bucket padrão: `dbavizee`.
 */
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_BUCKET = "dbavizee";

export interface UploadDbavizeeImageInput {
  /** Caminho final dentro do bucket (ex.: `branding/logo.png`). */
  path: string;
  file: File;
  contentType?: string;
  /** Default: `true` (sobrescreve). */
  upsert?: boolean;
}

/** Faz upload e devolve a URL pública para uso direto em <img>. */
export async function uploadDbavizeeImage(
  input: UploadDbavizeeImageInput,
): Promise<{ publicUrl: string }> {
  const { error } = await supabase.storage
    .from(DEFAULT_BUCKET)
    .upload(input.path, input.file, {
      upsert: input.upsert ?? true,
      contentType: input.contentType ?? input.file.type,
    });
  if (error) throw error;
  const { data } = supabase.storage.from(DEFAULT_BUCKET).getPublicUrl(input.path);
  return { publicUrl: data.publicUrl };
}