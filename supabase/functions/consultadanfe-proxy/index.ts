import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sanitizeForLog } from "../_shared/sanitize.ts";

import { buildCorsHeaders } from "../_shared/cors.ts";
import { fetchWithTimeout, isTimeoutError, timeoutResponse } from "../_shared/validate.ts";
import { checkRateLimit, rateLimitKey, rateLimitResponse } from "../_shared/rate-limit.ts";
let corsHeaders: Record<string, string> = buildCorsHeaders(null);
const API_BASE = "https://consultadanfe.com/api/v1";

interface ReqBody {
  action: "consulta" | "danfe";
  chave: string;
}

Deno.serve(async (req) => {
  corsHeaders = buildCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Auth obrigatória — função consome API paga e expõe consulta de NF-e de terceiros.
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return new Response(JSON.stringify({ error: "Sessão ausente." }), { status: 401, headers: jsonHeaders });
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Configuração do servidor incompleta." }), { status: 500, headers: jsonHeaders });
  }
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Sessão inválida." }), { status: 401, headers: jsonHeaders });
  }

  const rl = checkRateLimit(rateLimitKey(req, userData.user.id), {
    scope: "consultadanfe",
    limit: 30,
    windowSec: 60,
  });
  if (!rl.ok) return rateLimitResponse(rl, corsHeaders);

  // A API consultadanfe.com é pública, sem cadastro. O header X-Client-App
  // identifica o integrador apenas para estatísticas. Se o usuário tiver
  // configurado uma chave (uso futuro/premium), enviamos como Bearer.
  const apiKey = Deno.env.get("CONSULTADANFE_API_KEY");

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const chave = String(body?.chave ?? "").replace(/\D/g, "");
  if (chave.length !== 44) {
    return new Response(
      JSON.stringify({ error: "Chave de acesso inválida — exige 44 dígitos." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const action = body.action ?? "consulta";
  const endpoint = action === "danfe" ? "/danfe" : "/consulta";

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Client-App": "avizee-erp",
    };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const upstream = await fetchWithTimeout(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ chave, format: "json" }),
    }, 20_000);

    const text = await upstream.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    console.log("[consultadanfe] upstream", sanitizeForLog({
      action,
      status: upstream.status,
      contentType: upstream.headers.get("content-type"),
      keys:
        parsed && typeof parsed === "object"
          ? Object.keys(parsed as Record<string, unknown>)
          : null,
      sample: text.slice(0, 400),
    }));

    return new Response(
      JSON.stringify({
        ok: upstream.ok,
        status: upstream.status,
        errorCode: upstream.headers.get("x-error-code") ?? null,
        data: parsed,
      }),
      {
        status: upstream.ok ? 200 : upstream.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    if (isTimeoutError(e)) {
      return timeoutResponse(corsHeaders, "consultadanfe.com demorou demais para responder");
    }
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});