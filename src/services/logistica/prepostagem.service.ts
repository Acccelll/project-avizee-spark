/**
 * prepostagem.service — Cliente front-end para a API de pré-postagem
 * dos Correios (envelope na edge function `correios-api`).
 *
 * Fluxo (Onda A):
 *   1. gerarEtiqueta(remessaId)
 *      → cria pré-postagem nos Correios
 *      → solicita PDF assíncrono
 *      → faz polling do PDF (até 6 tentativas)
 *      → faz upload do PDF no bucket privado `etiquetas-correios`
 *      → grava registro em `remessa_etiquetas` (status='emitida')
 *      → atualiza `remessas.codigo_rastreio`
 *   2. baixarEtiqueta(etiquetaId) → URL assinada do bucket
 *   3. cancelarEtiqueta(etiquetaId) → DELETE na API e marca cancelada
 */

import { supabase } from "@/integrations/supabase/client";

export interface RemessaEtiqueta {
  id: string;
  remessa_id: string;
  status: "pendente" | "emitida" | "erro" | "cancelada";
  id_correios: string | null;
  codigo_objeto: string | null;
  id_recibo_pdf: string | null;
  pdf_path: string | null;
  erro_mensagem: string | null;
  created_at: string;
  updated_at: string;
}

const STORAGE_BUCKET = "etiquetas-correios";

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function base64ToBlob(b64: string, mime = "application/pdf"): Blob {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Lista as etiquetas conhecidas para uma remessa, mais recente primeiro. */
export async function listEtiquetasByRemessa(remessaId: string): Promise<RemessaEtiqueta[]> {
  const { data, error } = await supabase
    .from("remessa_etiquetas")
    .select("*")
    .eq("remessa_id", remessaId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as RemessaEtiqueta[];
}

/**
 * Lista a etiqueta mais recente (não cancelada) de cada remessa.
 * Usado pela coluna "Etiqueta" na lista de remessas em /logistica.
 */
export async function listLatestEtiquetasByRemessas(
  remessaIds: string[],
): Promise<Record<string, RemessaEtiqueta>> {
  if (remessaIds.length === 0) return {};
  const { data, error } = await supabase
    .from("remessa_etiquetas")
    .select("*")
    .in("remessa_id", remessaIds)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const map: Record<string, RemessaEtiqueta> = {};
  for (const row of (data ?? []) as RemessaEtiqueta[]) {
    if (!map[row.remessa_id]) map[row.remessa_id] = row;
  }
  return map;
}

/** Gera signed URL para download do PDF (válida por 5 min). */
export async function baixarEtiqueta(pdfPath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(pdfPath, 300);
  if (error || !data) throw new Error(error?.message ?? "Falha ao gerar link do PDF.");
  return data.signedUrl;
}

/**
 * Pipeline completo: criar pré-postagem → solicitar PDF → polling → upload → persistir.
 * Retorna o registro criado em `remessa_etiquetas`.
 */
export async function gerarEtiqueta(remessaId: string): Promise<RemessaEtiqueta> {
  // 1. Cria pré-postagem nos Correios
  const criarRes = await supabase.functions.invoke("correios-api", {
    body: { remessa_id: remessaId },
    method: "POST",
    headers: {},
  } as never).then((r) => r); // workaround tipos
  // O invoke não suporta query string nativamente — usamos URL direta.

  const sbUrl = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, "");
  const sbKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const sess = (await supabase.auth.getSession()).data.session;
  const token = sess?.access_token ?? sbKey;

  async function callAction<T>(actionQs: string, init: RequestInit): Promise<T> {
    const res = await fetch(`${sbUrl}/functions/v1/correios-api?action=${actionQs}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        apikey: sbKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const txt = await res.text();
    let data: unknown = {};
    try { data = JSON.parse(txt); } catch { /* */ }
    if (!res.ok) {
      const msg = (data as { error?: string }).error ?? `Falha na chamada (${res.status})`;
      throw new Error(msg);
    }
    return data as T;
  }

  void criarRes; // descartado; usaremos callAction abaixo

  // a) Criar pré-postagem
  let etiquetaInsertId: string | null = null;
  try {
    const criar = await callAction<{
      id: string;
      codigoObjeto: string;
      raw: unknown;
      requestBody: unknown;
    }>("prepostagem_criar", {
      method: "POST",
      body: JSON.stringify({ remessa_id: remessaId }),
    });

    // Persiste registro inicial
    const { data: inserted, error: insErr } = await supabase
      .from("remessa_etiquetas")
      .insert({
        remessa_id: remessaId,
        status: "pendente",
        id_correios: criar.id,
        codigo_objeto: criar.codigoObjeto,
        payload_request: criar.requestBody as never,
        payload_response: criar.raw as never,
      })
      .select()
      .single();
    if (insErr) throw new Error(insErr.message);
    etiquetaInsertId = inserted.id;

    // Atualiza código de rastreio na remessa (idempotente)
    if (criar.codigoObjeto) {
      await supabase
        .from("remessas")
        .update({ codigo_rastreio: criar.codigoObjeto })
        .eq("id", remessaId);
    }

    // b) Solicita rótulo assíncrono
    const rotulo = await callAction<{ idRecibo: string }>("prepostagem_rotulo", {
      method: "POST",
      body: JSON.stringify({ idsPrePostagem: [criar.id], tipoRotulo: "P" }),
    });
    await supabase
      .from("remessa_etiquetas")
      .update({ id_recibo_pdf: rotulo.idRecibo })
      .eq("id", etiquetaInsertId);

    // c) Polling do PDF
    let pdfBase64: string | null = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      await delay(1500 + attempt * 500);
      const pdf = await callAction<{ status: string; pdfBase64?: string }>(
        `prepostagem_pdf&idRecibo=${encodeURIComponent(rotulo.idRecibo)}`,
        { method: "GET" },
      );
      if (pdf.status === "pronto" && pdf.pdfBase64) {
        pdfBase64 = pdf.pdfBase64;
        break;
      }
    }
    if (!pdfBase64) {
      // Mantém status pendente; UI permite tentar novamente
      throw new Error("PDF ainda não disponível nos Correios. Tente novamente em alguns segundos.");
    }

    // d) Upload no Storage
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sessão expirada.");
    // empresa_id atual via RPC
    const { data: empresaIdData } = await supabase.rpc("current_empresa_id" as never);
    const empresaId = (empresaIdData as string | null) ?? "default";
    const path = `${empresaId}/${remessaId}/${etiquetaInsertId}.pdf`;
    const blob = base64ToBlob(pdfBase64);
    const { error: upErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, blob, { contentType: "application/pdf", upsert: true });
    if (upErr) throw new Error(`Upload do PDF falhou: ${upErr.message}`);

    // e) Marca emitida
    const { data: final, error: updErr } = await supabase
      .from("remessa_etiquetas")
      .update({ status: "emitida", pdf_path: path })
      .eq("id", etiquetaInsertId)
      .select()
      .single();
    if (updErr) throw new Error(updErr.message);
    return final as RemessaEtiqueta;
  } catch (e) {
    // Marca erro caso já tenhamos registro
    if (etiquetaInsertId) {
      await supabase
        .from("remessa_etiquetas")
        .update({ status: "erro", erro_mensagem: (e as Error).message })
        .eq("id", etiquetaInsertId);
    }
    throw e;
  }
}

/** Cancela uma pré-postagem ainda não postada fisicamente. */
export async function cancelarEtiqueta(etiqueta: RemessaEtiqueta): Promise<void> {
  if (!etiqueta.id_correios) throw new Error("Etiqueta sem id_correios.");
  const sbUrl = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, "");
  const sbKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const sess = (await supabase.auth.getSession()).data.session;
  const token = sess?.access_token ?? sbKey;
  const res = await fetch(`${sbUrl}/functions/v1/correios-api?action=prepostagem_cancelar`, {
    method: "POST",
    headers: { apikey: sbKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ idCorreios: etiqueta.id_correios }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Falha ao cancelar nos Correios: ${txt.slice(0, 200)}`);
  }
  const { error } = await supabase
    .from("remessa_etiquetas")
    .update({ status: "cancelada" })
    .eq("id", etiqueta.id);
  if (error) throw new Error(error.message);
}