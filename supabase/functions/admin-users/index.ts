// deno-lint-ignore-file no-explicit-any
/* eslint-disable @typescript-eslint/no-explicit-any */
// IMPORTANT: This function uses service role key and MUST NOT be accessed from arbitrary origins.
// The ALLOWED_ORIGIN env var MUST be set in production with the real application domain.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN");
if (!allowedOrigin) {
  console.warn("[admin-users] ALLOWED_ORIGIN env var is not set. Requests will be rejected.");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin ?? "",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INACTIVE_BAN_DURATION = "876000h";

type AppRole = "admin" | "vendedor" | "financeiro" | "estoquista";

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeRole(role: string | undefined): AppRole {
  if (role === "admin" || role === "financeiro" || role === "estoquista" || role === "vendedor") return role;
  return "vendedor";
}

function normalizePermissions(permissionKeys: unknown) {
  if (!Array.isArray(permissionKeys)) return [] as Array<{ resource: string; action: string; allowed: true }>;
  return permissionKeys
    .filter((value): value is string => typeof value === "string" && value.includes(":"))
    .map((value) => {
      const [resource, action] = value.split(":");
      return { resource, action, allowed: true as const };
    });
}

function isUserActive(user: any) {
  if (!user?.banned_until) return true;
  const bannedUntil = Date.parse(user.banned_until);
  return Number.isNaN(bannedUntil) || bannedUntil <= Date.now();
}

async function requireAdmin(serviceClient: any, req: Request) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Sessão inválida.");
  const { data: authData, error: authError } = await serviceClient.auth.getUser(token);
  if (authError || !authData.user) throw new HttpError(401, "Sessão inválida.");
  const { data: roles, error: rolesError } = await serviceClient.from("user_roles").select("role").eq("user_id", authData.user.id);
  if (rolesError) throw rolesError;
  const isAdmin = (roles ?? []).some((row: any) => row.role === "admin");
  if (!isAdmin) throw new HttpError(403, "Apenas administradores podem gerenciar usuários.");
  return authData.user;
}

async function replaceUserRole(serviceClient: any, userId: string, role: AppRole) {
  const { error: deleteError } = await serviceClient.from("user_roles").delete().eq("user_id", userId);
  if (deleteError) throw deleteError;
  const { error: insertError } = await serviceClient.from("user_roles").insert({ user_id: userId, role });
  if (insertError) throw insertError;
}

async function replaceUserPermissions(serviceClient: any, userId: string, permissionKeys: unknown) {
  const { error: deleteError } = await serviceClient.from("user_permissions").delete().eq("user_id", userId);
  if (deleteError) throw deleteError;
  const permissions = normalizePermissions(permissionKeys);
  if (permissions.length === 0) return;
  const { error: insertError } = await serviceClient.from("user_permissions").insert(permissions.map((p: any) => ({ user_id: userId, ...p })));
  if (insertError) throw insertError;
}

async function setUserActiveStatus(serviceClient: any, userId: string, ativo: boolean) {
  const { error } = await serviceClient.auth.admin.updateUserById(userId, {
    ban_duration: ativo ? "none" : INACTIVE_BAN_DURATION,
  });
  if (error) throw error;
}

async function insertAudit(serviceClient: any, actorId: string, targetUserId: string, rolePadrao: string | null, alteracao: Record<string, unknown>) {
  const { error } = await serviceClient.from("permission_audit").insert({
    user_id: actorId,
    target_user_id: targetUserId,
    role_padrao: rolePadrao,
    alteracao,
  });
  if (error) throw error;
}

async function listUsers(serviceClient: any) {
  const [authUsersResult, profilesResult, rolesResult, permissionsResult] = await Promise.all([
    serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    serviceClient.from("profiles").select("id, nome, email, cargo, created_at, updated_at"),
    serviceClient.from("user_roles").select("user_id, role"),
    serviceClient.from("user_permissions").select("user_id, resource, action").eq("allowed", true),
  ]);

  if (authUsersResult.error) throw authUsersResult.error;
  if (profilesResult.error) throw profilesResult.error;
  if (rolesResult.error) throw rolesResult.error;
  if (permissionsResult.error) throw permissionsResult.error;

  const authUsers = authUsersResult.data.users ?? [];
  const profiles = profilesResult.data ?? [];
  const roles = rolesResult.data ?? [];
  const permissions = permissionsResult.data ?? [];

  const authMap = new Map(authUsers.map((user: any) => [user.id, user]));
  const profileMap = new Map(profiles.map((p: any) => [p.id, p]));

  const roleMap = new Map<string, AppRole[]>();
  for (const roleRow of roles) {
    const uid = (roleRow as any).user_id as string;
    const existing = roleMap.get(uid) ?? [];
    existing.push(normalizeRole((roleRow as any).role));
    roleMap.set(uid, existing);
  }

  const permissionMap = new Map<string, string[]>();
  for (const permission of permissions) {
    const uid = (permission as any).user_id as string;
    const existing = permissionMap.get(uid) ?? [];
    existing.push(`${(permission as any).resource}:${(permission as any).action}`);
    permissionMap.set(uid, existing);
  }

  const userIds = new Set<string>([
    ...authUsers.map((user: any) => user.id as string),
    ...profiles.map((profile: any) => profile.id as string),
  ]);

  return Array.from(userIds)
    .map((userId) => {
      const authUser = authMap.get(userId) as any;
      const profile = profileMap.get(userId) as any;
      const email = profile?.email ?? authUser?.email ?? null;
      const fallbackName = authUser?.user_metadata?.full_name || (email as string)?.split("@")[0] || "Usuário";

      return {
        id: userId,
        nome: profile?.nome ?? fallbackName,
        email,
        cargo: profile?.cargo ?? null,
        ativo: isUserActive(authUser),
        created_at: profile?.created_at ?? authUser?.created_at ?? new Date().toISOString(),
        updated_at: profile?.updated_at ?? authUser?.updated_at ?? profile?.created_at ?? new Date().toISOString(),
        role_padrao: roleMap.get(userId)?.[0] ?? "vendedor",
        extra_permissions: permissionMap.get(userId) ?? [],
        last_sign_in: authUser?.last_sign_in_at ?? null,
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    if (!allowedOrigin) {
      return new Response(JSON.stringify({ error: "ALLOWED_ORIGIN env var is required" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("ok", { headers: corsHeaders });
  }

  if (!allowedOrigin) {
    return new Response(JSON.stringify({ error: "ALLOWED_ORIGIN env var is required" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const currentUser = await requireAdmin(serviceClient, req);
    const { action, payload = {} } = await req.json();

    if (action === "list") {
      return json({ users: await listUsers(serviceClient) });
    }

    if (action === "create") {
      const nome = String(payload.nome ?? "").trim();
      const email = String(payload.email ?? "").trim().toLowerCase();
      const cargo = String(payload.cargo ?? "").trim();
      const ativo = payload.ativo !== false;
      const rolePadrao = normalizeRole(payload.role_padrao);

      if (!nome || !email) throw new HttpError(400, "Nome e e-mail são obrigatórios.");

      const existingUsersResult = await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (existingUsersResult.error) throw existingUsersResult.error;
      const alreadyExists = (existingUsersResult.data.users ?? []).some((user: any) => user.email?.toLowerCase() === email);
      if (alreadyExists) throw new HttpError(409, "Já existe um usuário cadastrado com este e-mail.");

      const inviteResult = await serviceClient.auth.admin.inviteUserByEmail(email, { data: { full_name: nome } });
      if (inviteResult.error || !inviteResult.data.user) throw inviteResult.error ?? new Error("Não foi possível criar o usuário.");

      const targetUser = inviteResult.data.user;
      const now = new Date().toISOString();

      const { error: profileError } = await serviceClient.from("profiles").upsert({ id: targetUser.id, nome, email, cargo: cargo || null, updated_at: now }, { onConflict: "id" });
      if (profileError) throw profileError;

      await replaceUserRole(serviceClient, targetUser.id, rolePadrao);
      await replaceUserPermissions(serviceClient, targetUser.id, payload.extra_permissions);
      if (!ativo) await setUserActiveStatus(serviceClient, targetUser.id, false);

      await insertAudit(serviceClient, currentUser.id, targetUser.id, rolePadrao, {
        tipo: "user_create", email, cargo: cargo || null, ativo, extra_permissions: payload.extra_permissions ?? [],
      });

      return json({ ok: true, userId: targetUser.id });
    }

    if (action === "update") {
      const id = String(payload.id ?? "").trim();
      const nome = String(payload.nome ?? "").trim();
      const email = String(payload.email ?? "").trim().toLowerCase();
      const cargo = String(payload.cargo ?? "").trim();
      const ativo = payload.ativo !== false;
      const rolePadrao = normalizeRole(payload.role_padrao);

      if (!id || !nome) throw new HttpError(400, "Usuário inválido.");

      const { error: authUpdateError } = await serviceClient.auth.admin.updateUserById(id, { user_metadata: { full_name: nome } });
      if (authUpdateError) throw authUpdateError;

      const { error: profileError } = await serviceClient.from("profiles").upsert({ id, nome, email: email || null, cargo: cargo || null, updated_at: new Date().toISOString() }, { onConflict: "id" });
      if (profileError) throw profileError;

      await replaceUserRole(serviceClient, id, rolePadrao);
      await replaceUserPermissions(serviceClient, id, payload.extra_permissions);
      await setUserActiveStatus(serviceClient, id, ativo);

      await insertAudit(serviceClient, currentUser.id, id, rolePadrao, {
        tipo: "user_update", cargo: cargo || null, ativo, extra_permissions: payload.extra_permissions ?? [],
      });

      return json({ ok: true });
    }

    if (action === "toggle-status") {
      const id = String(payload.id ?? "").trim();
      const ativo = payload.ativo === true;
      if (!id) throw new HttpError(400, "Usuário inválido.");
      await setUserActiveStatus(serviceClient, id, ativo);
      await insertAudit(serviceClient, currentUser.id, id, null, { tipo: "status_change", ativo });
      return json({ ok: true });
    }

    throw new HttpError(400, "Ação inválida.");
  } catch (error) {
    console.error("[admin-users]", error);
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    return json({ error: error instanceof Error ? error.message : "Erro interno ao gerenciar usuários." }, 500);
  }
});
