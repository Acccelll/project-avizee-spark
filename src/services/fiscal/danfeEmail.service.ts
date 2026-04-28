/**
 * Envio do DANFE por e-mail (Onda 7).
 *
 * Fluxo:
 *  1. Gera o PDF localmente com `gerarDanfePdf` (usa o mesmo serviço da UI).
 *  2. Faz upload no bucket privado `danfe-pdfs` (`<nf_id>/<chave>.pdf`).
 *  3. Cria signed URL válido por 7 dias.
 *  4. Chama `send-transactional-email` com o template `nfe-autorizada`,
 *     passando os links de download e os metadados-chave da NF.
 *
 * O envio em si passa pela fila pgmq do `process-email-queue` —
 * essa função apenas enfileira.
 */

import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { gerarDanfePdf, type DanfeInput } from "./danfe.service";

const BUCKET = "danfe-pdfs";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dias

export interface EnviarDanfeEmailParams {
  nfId: string;
  destinatarioEmail: string;
  destinatarioNome?: string | null;
  danfe: DanfeInput;
  mensagem?: string | null;
}

export interface EnviarDanfeEmailResult {
  ok: boolean;
  linkDanfe?: string;
  storagePath?: string;
  erro?: string;
}

export async function enviarDanfePorEmail(
  p: EnviarDanfeEmailParams,
): Promise<EnviarDanfeEmailResult> {
  if (!p.destinatarioEmail || !p.destinatarioEmail.includes("@")) {
    return { ok: false, erro: "E-mail do destinatário inválido." };
  }

  // 1. Gera o PDF como Blob
  const blob = gerarDanfePdf(p.danfe, false);
  const buffer = await blob.arrayBuffer();

  // 2. Upload no bucket
  const safeChave = (p.danfe.chave_acesso ?? p.nfId).replace(/\D/g, "") || p.nfId;
  const path = `${p.nfId}/DANFE-${p.danfe.numero}-serie${p.danfe.serie ?? "1"}-${safeChave}.pdf`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (upErr) return { ok: false, erro: `Falha no upload do PDF: ${upErr.message}` };

  // 3. Signed URL
  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS, {
      download: `DANFE-${p.danfe.numero}.pdf`,
    });
  if (signErr || !signed?.signedUrl) {
    return { ok: false, erro: signErr?.message ?? "Não foi possível gerar link assinado." };
  }

  // 4. Enfileirar e-mail transacional
  const { error: mailErr } = await supabase.functions.invoke("send-transactional-email", {
    body: {
      template: "nfe-autorizada",
      to: p.destinatarioEmail,
      purpose: "transactional",
      idempotency_key: `danfe-${p.nfId}-${Date.now()}`,
      data: {
        numero: p.danfe.numero,
        serie: p.danfe.serie ?? "1",
        clienteNome: p.destinatarioNome ?? p.danfe.destinatario.nome,
        chaveAcesso: p.danfe.chave_acesso ?? "",
        protocolo: p.danfe.protocolo_autorizacao ?? "",
        valorTotal: formatCurrency(p.danfe.valor_total ?? 0),
        dataEmissao: formatDate(p.danfe.data_emissao),
        linkDanfe: signed.signedUrl,
        mensagem: p.mensagem ?? undefined,
      },
    },
  });
  if (mailErr) {
    return { ok: false, linkDanfe: signed.signedUrl, storagePath: path, erro: mailErr.message };
  }

  return { ok: true, linkDanfe: signed.signedUrl, storagePath: path };
}