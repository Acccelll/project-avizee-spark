/**
 * Serviço cliente da edge function `ia-extracao-documento`.
 *
 * Recebe um File (PDF/JPG/PNG), envia ao backend em base64 e devolve um
 * objeto tipado com os campos extraídos. Não persiste nada — apenas extrai.
 */
import { supabase } from "@/integrations/supabase/client";

export type TipoExtracao = "boleto" | "nota" | "extrato";

export interface ExtracaoBoleto {
  valor: number | null;
  data_vencimento: string | null;
  beneficiario_nome: string | null;
  beneficiario_documento: string | null;
  linha_digitavel: string | null;
  nosso_numero: string | null;
  confianca?: "alta" | "media" | "baixa";
}
export interface ExtracaoNota {
  valor_total: number | null;
  data_emissao: string | null;
  fornecedor_nome: string | null;
  fornecedor_documento: string | null;
  numero: string | null;
  serie: string | null;
  chave_acesso: string | null;
  confianca?: "alta" | "media" | "baixa";
}
export interface ExtracaoExtratoItem {
  data: string;
  descricao: string;
  valor: number;
  tipo: "credito" | "debito";
}
export interface ExtracaoExtrato {
  lancamentos: ExtracaoExtratoItem[];
  confianca?: "alta" | "media" | "baixa";
}

export type ExtracaoResultado<T extends TipoExtracao> = T extends "boleto"
  ? { tipo: "boleto"; dados: ExtracaoBoleto; confianca: "alta" | "media" | "baixa" }
  : T extends "nota"
  ? { tipo: "nota"; dados: ExtracaoNota; confianca: "alta" | "media" | "baixa" }
  : { tipo: "extrato"; dados: ExtracaoExtrato; confianca: "alta" | "media" | "baixa" };

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Falha ao ler o arquivo."));
        return;
      }
      // result = "data:application/pdf;base64,XXXX" — retira o prefixo
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Erro de leitura."));
    reader.readAsDataURL(file);
  });
}

const MAX_BYTES = 10 * 1024 * 1024;

export async function extrairDocumento<T extends TipoExtracao>(
  file: File,
  tipo: T,
): Promise<ExtracaoResultado<T>> {
  if (file.size > MAX_BYTES) {
    throw new Error("Arquivo muito grande. Limite: 10 MB.");
  }
  const arquivo_base64 = await fileToBase64(file);
  const media_type = (file.type || "").toLowerCase() || "application/octet-stream";

  const { data, error } = await supabase.functions.invoke("ia-extracao-documento", {
    body: { tipo, arquivo_base64, media_type },
  });

  if (error) {
    // supabase-js puts the function's JSON error body in `context.body`
    let msg = error.message ?? "Falha na extração.";
    try {
      const ctx = (error as { context?: { body?: string } }).context;
      if (ctx?.body) {
        const parsed = JSON.parse(ctx.body) as { erro?: string };
        if (parsed?.erro) msg = parsed.erro;
      }
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  const payload = data as {
    sucesso?: boolean;
    erro?: string;
    tipo?: TipoExtracao;
    dados?: unknown;
    confianca?: "alta" | "media" | "baixa";
  };
  if (!payload?.sucesso || !payload.dados) {
    throw new Error(payload?.erro ?? "Não foi possível interpretar o documento.");
  }

  return {
    tipo,
    dados: payload.dados as never,
    confianca: payload.confianca ?? "media",
  } as ExtracaoResultado<T>;
}