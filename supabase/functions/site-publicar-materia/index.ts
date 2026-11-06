// Edge Function: site-publicar-materia
//
// POST { materia_id }  → publica no site AviZee uma matéria aprovada.
// Exige JWT de usuário com `conteudo:publicar` (ou admin).
// Segredos: SITE_BASE_URL, SITE_ERP_CONTENT_SECRET.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import { requireAnyPermission } from "../_shared/permissions.ts";
import { publicarMateriaNoSite, SiteIntegrationError } from "../_shared/site-materias.ts";
import { validateJson, z } from "../_shared/validate.ts";

const bodySchema = z.object({ materia_id: z.string().uuid() });

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
  const log = createLogger("site-publicar-materia", req);

  const respond = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: jsonHeaders });

  if (req.method !== "POST") return respond(405, { error: "Use POST" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return respond(401, { error: "Não autenticado" });
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return respond(401, { error: "Sessão inválida" });
  const userId = userData.user.id;

  try {
    await requireAnyPermission(userId, [{ resource: "conteudo", action: "publicar" }]);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 403;
    return respond(status, { error: "Sem permissão para publicar matérias" });
  }

  const parsed = await validateJson(req, bodySchema, corsHeaders);
  if (!parsed.ok) return parsed.response;

  try {
    const result = await publicarMateriaNoSite(admin, parsed.data.materia_id, userId);
    log.info("materia publicada", { materia_id: parsed.data.materia_id });
    return respond(200, { ok: true, ...result });
  } catch (err) {
    if (err instanceof SiteIntegrationError) {
      log.warn("falha ao publicar", { status: err.status, cause: err.cause_ });
      return respond(err.status, { ok: false, error: err.message });
    }
    log.error("erro inesperado", { error: String(err) });
    return respond(500, { ok: false, error: "Erro inesperado ao publicar" });
  }
});
