// Instagram OAuth (Facebook Login for Business) — Onda 1 do módulo Social.
// Endpoints:
//   GET /instagram-oauth/start    → redirect ao Facebook Login
//   GET /instagram-oauth/callback → troca code → long-lived token, descobre IG ids
//                                   e faz upsert em social_contas.
//
// Secrets necessários no projeto:
//   META_APP_ID, META_APP_SECRET, OAUTH_STATE_SECRET, ALLOWED_ORIGIN
//
// Observação: configurado com verify_jwt = false (callback do Meta não envia JWT).
// O `start` valida o JWT manualmente para amarrar o state ao usuário.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_APP_ID = Deno.env.get("META_APP_ID") ?? "";
const META_APP_SECRET = Deno.env.get("META_APP_SECRET") ?? "";
const OAUTH_STATE_SECRET = Deno.env.get("OAUTH_STATE_SECRET") ?? "";
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";

const SCOPES = [
  "instagram_basic",
  "instagram_manage_insights",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
].join(",");

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── HMAC state helpers ─────────────────────────────────────────
async function signState(payload: Record<string, unknown>): Promise<string> {
  const body = btoa(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(OAUTH_STATE_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const sigHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${body}.${sigHex}`;
}

async function verifyState(state: string): Promise<Record<string, unknown> | null> {
  const [body, sigHex] = state.split(".");
  if (!body || !sigHex) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(OAUTH_STATE_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expectedHex = Array.from(new Uint8Array(expected))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (expectedHex !== sigHex) return null;
  try {
    return JSON.parse(atob(body));
  } catch {
    return null;
  }
}

// ── HTTP handler ───────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop() ?? "";

  try {
    if (!META_APP_ID || !META_APP_SECRET || !OAUTH_STATE_SECRET) {
      return jsonError(503, "META_APP_ID / META_APP_SECRET / OAUTH_STATE_SECRET não configurados");
    }

    if (path === "start") return await handleStart(req, url);
    if (path === "callback") return await handleCallback(url);

    return jsonError(404, `Rota desconhecida: ${path}`);
  } catch (e) {
    console.error("[instagram-oauth]", e);
    return jsonError(500, e instanceof Error ? e.message : "Erro interno");
  }
});

async function handleStart(req: Request, url: URL): Promise<Response> {
  // Identifica o usuário a partir do bearer (a UI envia o token do Supabase).
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return jsonError(401, "Authorization Bearer ausente");

  const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData.user) return jsonError(401, "Token inválido");

  const returnTo = url.searchParams.get("return_to") || "/social";
  const state = await signState({
    uid: userData.user.id,
    nonce: crypto.randomUUID(),
    return_to: returnTo,
    iat: Date.now(),
  });

  const redirectUri = `${SUPABASE_URL}/functions/v1/instagram-oauth/callback`;
  const fbUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  fbUrl.searchParams.set("client_id", META_APP_ID);
  fbUrl.searchParams.set("redirect_uri", redirectUri);
  fbUrl.searchParams.set("scope", SCOPES);
  fbUrl.searchParams.set("response_type", "code");
  fbUrl.searchParams.set("state", state);

  return new Response(JSON.stringify({ authorize_url: fbUrl.toString() }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleCallback(url: URL): Promise<Response> {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return jsonError(400, "code/state ausentes");

  const statePayload = await verifyState(state);
  if (!statePayload) return jsonError(400, "state inválido");

  const redirectUri = `${SUPABASE_URL}/functions/v1/instagram-oauth/callback`;

  // 1) short-lived token
  const shortRes = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?` +
      new URLSearchParams({
        client_id: META_APP_ID,
        client_secret: META_APP_SECRET,
        redirect_uri: redirectUri,
        code,
      }),
  );
  const shortData = await shortRes.json();
  if (!shortRes.ok || !shortData.access_token) {
    return jsonError(502, `Falha no exchange short-lived: ${JSON.stringify(shortData)}`);
  }

  // 2) long-lived (60d)
  const longRes = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?` +
      new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: META_APP_ID,
        client_secret: META_APP_SECRET,
        fb_exchange_token: shortData.access_token,
      }),
  );
  const longData = await longRes.json();
  const longLivedToken = longData.access_token as string | undefined;
  const expiresIn = (longData.expires_in as number | undefined) ?? 60 * 24 * 3600;
  if (!longLivedToken) {
    return jsonError(502, `Falha no exchange long-lived: ${JSON.stringify(longData)}`);
  }

  // 3) descobre /me + pages
  const meRes = await fetch(
    `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${longLivedToken}`,
  );
  const me = await meRes.json();
  if (!me.id) return jsonError(502, `Falha em /me: ${JSON.stringify(me)}`);

  const pagesRes = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,profile_picture_url}&access_token=${longLivedToken}`,
  );
  const pages = await pagesRes.json();
  if (!Array.isArray(pages.data)) {
    return jsonError(502, `Falha em /me/accounts: ${JSON.stringify(pages)}`);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const expiraEm = new Date(Date.now() + expiresIn * 1000).toISOString();
  const conectadas: Array<{ ig_id: string; username: string }> = [];

  for (const page of pages.data) {
    const ig = page.instagram_business_account;
    if (!ig?.id) continue;
    const username = ig.username ?? page.name;

    const { error } = await admin
      .from("social_contas")
      .upsert(
        {
          plataforma: "instagram_business",
          identificador_externo: ig.id,
          nome_conta: username,
          url_conta: `https://instagram.com/${username}`,
          access_token: page.access_token, // page token (usado para Insights IG)
          token_expira_em: expiraEm,
          status_conexao: "conectado",
          ativo: true,
          escopos: SCOPES.split(","),
          meta_user_id: String(me.id),
          facebook_page_id: page.id,
          ultima_sincronizacao: null,
        },
        { onConflict: "plataforma,identificador_externo" },
      );
    if (error) {
      console.error("[instagram-oauth] upsert error", error);
      continue;
    }
    conectadas.push({ ig_id: ig.id, username });

    // Subscribe webhooks (opcional — falha silenciosa se app não tiver webhooks habilitados)
    fetch(
      `https://graph.facebook.com/v19.0/${ig.id}/subscribed_apps?subscribed_fields=comments,mentions,story_insights&access_token=${page.access_token}`,
      { method: "POST" },
    ).catch(() => {});
  }

  // Redireciona o navegador de volta à app
  const returnTo = (statePayload.return_to as string) || "/social";
  const appOrigin = ALLOWED_ORIGIN === "*" ? url.origin : ALLOWED_ORIGIN;
  const target = new URL(returnTo, appOrigin);
  target.searchParams.set("ig_connected", String(conectadas.length));
  return Response.redirect(target.toString(), 302);
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}