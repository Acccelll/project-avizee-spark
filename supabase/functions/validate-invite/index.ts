/**
 * `validate-invite` — valida o token de convite no momento do signup.
 *
 * Server-side: complementa a flag `INVITE_ONLY` (que é só client) impedindo
 * que chamadas diretas à API do Supabase Auth burlem o fluxo de convite.
 *
 * Fluxo:
 * 1. Cliente envia { token, email } antes de chamar `signUp`.
 * 2. Função verifica se o token existe, não foi usado e não expirou.
 * 3. Se o convite for vinculado a um e-mail específico, valida o match.
 * 4. Retorna { valid: true, role } ou { valid: false, reason }.
 *
 * O token só é "consumido" (gravado `used_at/used_by`) pelo trigger
 * `handle_new_user` quando o usuário é efetivamente criado.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createLogger } from "../_shared/logger.ts";

const moduleLog = createLogger("validate-invite");

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token, email } = await req.json();

    if (!token || typeof token !== "string") {
      return new Response(
        JSON.stringify({ valid: false, reason: "missing_token" }),
        { status: 400, headers: corsHeaders },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data, error } = await supabase
      .from("invites")
      .select("id, email, role, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();

    if (error || !data) {
      return new Response(
        JSON.stringify({ valid: false, reason: "not_found" }),
        { status: 200, headers: corsHeaders },
      );
    }

    if (data.used_at) {
      return new Response(
        JSON.stringify({ valid: false, reason: "already_used" }),
        { status: 200, headers: corsHeaders },
      );
    }

    if (new Date(data.expires_at).getTime() < Date.now()) {
      return new Response(
        JSON.stringify({ valid: false, reason: "expired" }),
        { status: 200, headers: corsHeaders },
      );
    }

    if (
      email &&
      data.email &&
      data.email.toLowerCase().trim() !== String(email).toLowerCase().trim()
    ) {
      return new Response(
        JSON.stringify({ valid: false, reason: "email_mismatch" }),
        { status: 200, headers: corsHeaders },
      );
    }

    return new Response(
      JSON.stringify({ valid: true, role: data.role }),
      { status: 200, headers: corsHeaders },
    );
  } catch (err) {
    console.error("[validate-invite] error", err);
    return new Response(
      JSON.stringify({ valid: false, reason: "internal_error" }),
      { status: 500, headers: corsHeaders },
    );
  }
});