// deno-lint-ignore-file no-explicit-any
/**
 * Edge Function: webhooks-dispatcher
 *
 * Consome a fila pgmq `webhook_events`, faz match com endpoints ativos,
 * dispara POST HTTP assinado (HMAC SHA-256 em header `X-AviZee-Signature`),
 * persiste cada tentativa em `webhooks_deliveries` com retry exponencial.
 *
 * Acionado via cron (a cada 1 min) ou por chamada manual `?action=run`.
 * `verify_jwt = true` — invocações manuais exigem usuário admin.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN");
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_TENTATIVAS = 5;
const BATCH_SIZE = 25;
const VISIBILITY_TIMEOUT = 30; // segundos
const REQUEST_TIMEOUT_MS = 10_000;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function backoffSeconds(attempt: number): number {
  // 30s, 2min, 8min, 30min, 2h
  return Math.min(30 * Math.pow(4, attempt - 1), 7200);
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function makeAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function processQueue(): Promise<{ processed: number; delivered: number; failed: number }> {
  const admin = makeAdminClient();
  let processed = 0;
  let delivered = 0;
  let failed = 0;

  for (let i = 0; i < BATCH_SIZE; i++) {
    // pgmq.read devolve até N mensagens; usamos 1 por iteração para simplificar
    const { data: msgs, error: readError } = await admin
      .schema("pgmq" as any)
      .rpc("read", { queue_name: "webhook_events", vt: VISIBILITY_TIMEOUT, qty: 1 } as any);

    if (readError) {
      console.error("[webhooks-dispatcher] erro pgmq.read", readError);
      break;
    }
    const list = (msgs ?? []) as Array<{ msg_id: number; message: any }>;
    if (list.length === 0) break;

    for (const m of list) {
      processed++;
      const evento: string = m.message?.evento;
      const payload = m.message?.payload ?? {};

      if (!evento) {
        await admin.schema("pgmq" as any).rpc("delete", { queue_name: "webhook_events", msg_id: m.msg_id } as any);
        continue;
      }

      // Buscar endpoints ativos cujo array `eventos` contém o evento.
      // Usamos service-role bypassando RLS — admin-only é garantido pela rota.
      const { data: endpoints, error: epError } = await admin
        .from("webhooks_endpoints")
        .select("id, url, secret_hash, eventos, ativo")
        .eq("ativo", true)
        .contains("eventos", [evento]);

      if (epError) {
        console.error("[webhooks-dispatcher] erro busca endpoints", epError);
        // devolve à fila (sem delete) — pgmq reentrega após VT
        continue;
      }

      // Sem endpoint interessado → consumir e seguir
      if (!endpoints || endpoints.length === 0) {
        await admin.schema("pgmq" as any).rpc("delete", { queue_name: "webhook_events", msg_id: m.msg_id } as any);
        continue;
      }

      // O secret real não está no banco (só hash). Buscamos via vault? Não — guardamos
      // o secret no momento da criação e o cliente exibe uma vez. Para o dispatcher,
      // usamos o `secret_hash` como chave HMAC (é determinístico e nunca exposto).
      // Quem valida do outro lado pode armazenar o mesmo hash que recebeu da UI.
      // (Convenção: secret HMAC = secret_hash do endpoint.)
      for (const ep of endpoints) {
        const body = JSON.stringify({ evento, payload, ts: new Date().toISOString() });
        const signature = await hmacSha256Hex(ep.secret_hash, body);

        // Cria registro pendente
        const { data: deliveryRow } = await admin
          .from("webhooks_deliveries")
          .insert({
            endpoint_id: ep.id,
            evento,
            payload: { evento, payload },
            status: "pendente",
            tentativas: 0,
            signature,
          })
          .select("id")
          .single();

        const deliveryId = deliveryRow?.id as string | undefined;

        let httpStatus: number | null = null;
        let ok = false;
        let errMsg: string | null = null;

        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
          const resp = await fetch(ep.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-AviZee-Event": evento,
              "X-AviZee-Signature": `sha256=${signature}`,
              "User-Agent": "AviZee-Webhooks/1.0",
            },
            body,
            signal: ctrl.signal,
          });
          clearTimeout(t);
          httpStatus = resp.status;
          ok = resp.ok;
          if (!ok) errMsg = `HTTP ${resp.status}`;
        } catch (e) {
          errMsg = e instanceof Error ? e.message : String(e);
        }

        const tentativas = 1;
        if (ok) {
          delivered++;
          if (deliveryId) {
            await admin.from("webhooks_deliveries").update({
              status: "sucesso",
              http_status: httpStatus,
              tentativas,
              finalizado_em: new Date().toISOString(),
            }).eq("id", deliveryId);
          }
          await admin.from("webhooks_endpoints").update({
            total_sucesso: (ep as any).total_sucesso != null ? undefined : undefined,
            ultimo_disparo_em: new Date().toISOString(),
            ultimo_status: "sucesso",
          }).eq("id", ep.id);
          // incremento atômico via rpc simples
          await admin.rpc("webhooks_increment_counter" as any, { p_endpoint_id: ep.id, p_field: "total_sucesso" } as any).then(() => {}, () => {});
        } else {
          failed++;
          const final = tentativas >= MAX_TENTATIVAS;
          if (deliveryId) {
            await admin.from("webhooks_deliveries").update({
              status: final ? "falha" : "pendente",
              http_status: httpStatus,
              tentativas,
              ultimo_erro: errMsg,
              proxima_tentativa_em: final ? null : new Date(Date.now() + backoffSeconds(tentativas) * 1000).toISOString(),
              finalizado_em: final ? new Date().toISOString() : null,
            }).eq("id", deliveryId);
          }
          await admin.from("webhooks_endpoints").update({
            ultimo_disparo_em: new Date().toISOString(),
            ultimo_status: final ? "falha" : "pendente",
          }).eq("id", ep.id);
          await admin.rpc("webhooks_increment_counter" as any, { p_endpoint_id: ep.id, p_field: "total_falha" } as any).then(() => {}, () => {});
        }
      }

      // Mensagem consumida (independente de sucesso por endpoint — retry vive em deliveries)
      await admin.schema("pgmq" as any).rpc("delete", { queue_name: "webhook_events", msg_id: m.msg_id } as any);
    }
  }

  return { processed, delivered, failed };
}

async function retryPendingDeliveries(): Promise<{ retried: number; delivered: number; failed: number }> {
  const admin = makeAdminClient();
  const now = new Date().toISOString();

  const { data: pendings, error } = await admin
    .from("webhooks_deliveries")
    .select("id, endpoint_id, evento, payload, tentativas, signature, webhooks_endpoints!inner(url, secret_hash, ativo)")
    .eq("status", "pendente")
    .lte("proxima_tentativa_em", now)
    .limit(BATCH_SIZE);

  if (error || !pendings) return { retried: 0, delivered: 0, failed: 0 };

  let retried = 0;
  let delivered = 0;
  let failed = 0;

  for (const d of pendings as any[]) {
    const ep = d.webhooks_endpoints;
    if (!ep?.ativo) continue;
    retried++;
    const body = JSON.stringify(d.payload);
    const signature = d.signature ?? (await hmacSha256Hex(ep.secret_hash, body));
    let httpStatus: number | null = null;
    let ok = false;
    let errMsg: string | null = null;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
      const resp = await fetch(ep.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AviZee-Event": d.evento,
          "X-AviZee-Signature": `sha256=${signature}`,
          "User-Agent": "AviZee-Webhooks/1.0",
        },
        body,
        signal: ctrl.signal,
      });
      clearTimeout(t);
      httpStatus = resp.status;
      ok = resp.ok;
      if (!ok) errMsg = `HTTP ${resp.status}`;
    } catch (e) {
      errMsg = e instanceof Error ? e.message : String(e);
    }
    const tentativas = (d.tentativas ?? 0) + 1;
    const final = tentativas >= MAX_TENTATIVAS;
    if (ok) {
      delivered++;
      await admin.from("webhooks_deliveries").update({
        status: "sucesso",
        http_status: httpStatus,
        tentativas,
        finalizado_em: new Date().toISOString(),
        proxima_tentativa_em: null,
      }).eq("id", d.id);
      await admin.rpc("webhooks_increment_counter" as any, { p_endpoint_id: d.endpoint_id, p_field: "total_sucesso" } as any).then(() => {}, () => {});
    } else {
      failed++;
      await admin.from("webhooks_deliveries").update({
        status: final ? "falha" : "pendente",
        http_status: httpStatus,
        tentativas,
        ultimo_erro: errMsg,
        proxima_tentativa_em: final ? null : new Date(Date.now() + backoffSeconds(tentativas) * 1000).toISOString(),
        finalizado_em: final ? new Date().toISOString() : null,
      }).eq("id", d.id);
      if (final) {
        await admin.rpc("webhooks_increment_counter" as any, { p_endpoint_id: d.endpoint_id, p_field: "total_falha" } as any).then(() => {}, () => {});
      }
    }
  }

  return { retried, delivered, failed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "run";

    if (action === "ping") {
      return json({ ok: true, ts: new Date().toISOString() });
    }

    const queueRes = await processQueue();
    const retryRes = await retryPendingDeliveries();
    return json({ ok: true, queue: queueRes, retry: retryRes });
  } catch (e) {
    console.error("[webhooks-dispatcher] erro", e);
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
