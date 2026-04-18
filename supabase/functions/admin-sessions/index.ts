// deno-lint-ignore-file no-explicit-any
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Edge Function: admin-sessions
 * Lista e revoga sessões de usuários (somente para administradores).
 *
 * POST { action: "list" }     → lista todos os usuários com info de sessão
 * POST { action: "revoke", userId: "..." } → revoga todas as sessões do usuário
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN");
if (!allowedOrigin) {
  console.warn("[admin-sessions] ALLOWED_ORIGIN env var is not set. Requests will be rejected.");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin ?? "",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function requireAdmin(serviceClient: any, req: Request) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw { status: 401, message: "Sessão inválida." };

  const { data: authData, error: authError } =
    await serviceClient.auth.getUser(token);
  if (authError || !authData.user)
    throw { status: 401, message: "Sessão inválida." };

  const { data: roles } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", authData.user.id);

  const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
  if (!isAdmin)
    throw {
      status: 403,
      message: "Apenas administradores podem gerenciar sessões.",
    };

  return authData.user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    if (!allowedOrigin) {
      return new Response(
        JSON.stringify({ error: "ALLOWED_ORIGIN env var is required" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response("ok", { headers: corsHeaders });
  }

  if (!allowedOrigin) {
    return new Response(
      JSON.stringify({ error: "ALLOWED_ORIGIN env var is required" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    await requireAdmin(serviceClient, req);

    const { action, userId } = await req.json();

    if (action === "list") {
      const { data: usersData, error: usersError } =
        await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (usersError) throw usersError;

      const { data: profiles } = await serviceClient
        .from("profiles")
        .select("id, nome");
      const profileMap = new Map(
        (profiles ?? []).map((p: any) => [p.id, p.nome]),
      );

      const sessoes = (usersData.users ?? []).map((user: any) => ({
        id: user.id,
        user_id: user.id,
        user_email: user.email ?? null,
        user_name: profileMap.get(user.id) ?? user.user_metadata?.full_name ?? null,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at ?? null,
        user_agent: null, // Not available via admin API
        ip: null, // Not available via admin API
      }));

      return json(sessoes);
    }

    if (action === "revoke") {
      if (!userId) return json({ error: "userId é obrigatório" }, 400);

      const { error } = await serviceClient.auth.admin.signOut(userId, "global");
      if (error) throw error;

      return json({ success: true });
    }

    return json({ error: "Ação inválida. Use 'list' ou 'revoke'." }, 400);
  } catch (err: any) {
    console.error("[admin-sessions]", err);
    const status = err.status ?? 500;
    const message =
      err.message ?? "Erro interno ao gerenciar sessões.";
    return json({ error: message }, status);
  }
});
