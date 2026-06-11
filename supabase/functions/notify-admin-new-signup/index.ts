/**
 * `notify-admin-new-signup` — enfileira notificação de novo cadastro para o admin.
 *
 * Acionada manualmente após `signUp` bem-sucedido no client. Enfileira via
 * `pgmq` (fila `email_queue`) consumida por `process-email-queue` — segue o
 * padrão de e-mails assíncronos já existente no projeto.
 *
 * Não usa role JWT — usa Service Role para enfileirar mesmo sem sessão
 * (usuário acabou de se cadastrar e ainda não confirmou o e-mail).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createLogger } from "../_shared/logger.ts";

const moduleLog = createLogger("notify-admin-new-signup");

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
    // Defesa 1: exigir o anon key como prova de origem do app.
    // Não é segredo forte, mas elimina abuso trivial de terceiros sem o key.
    const apikey =
      req.headers.get("apikey") ??
      req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    const expectedAnon = Deno.env.get("SUPABASE_ANON_KEY");
    if (!apikey || !expectedAnon || apikey !== expectedAnon) {
      return new Response(
        JSON.stringify({ ok: false, reason: "unauthorized" }),
        { status: 401, headers: corsHeaders },
      );
    }

    const { email, nome } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ ok: false, reason: "missing_email" }),
        { status: 400, headers: corsHeaders },
      );
    }

    const adminEmail = Deno.env.get("ADMIN_EMAIL") ?? "admin@avizee.com.br";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Defesa 2: dedupe — no máximo 1 notificação por e-mail a cada 10min.
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("signup_notify_dedupe")
      .select("email,last_sent_at")
      .eq("email", email)
      .gte("last_sent_at", tenMinAgo)
      .maybeSingle();

    if (recent) {
      return new Response(
        JSON.stringify({ ok: true, deduped: true }),
        { status: 200, headers: corsHeaders },
      );
    }

    const subject = "Novo cadastro pendente de aprovação";
    const body = [
      `<p>Um novo usuário se cadastrou no sistema e está aguardando aprovação:</p>`,
      `<ul>`,
      `<li><strong>Nome:</strong> ${nome ?? "(não informado)"}</li>`,
      `<li><strong>E-mail:</strong> ${email}</li>`,
      `</ul>`,
      `<p>Acesse <a href="${Deno.env.get("APP_URL") ?? ""}/administracao/usuarios">Administração → Usuários</a> para aprovar o acesso e atribuir permissões.</p>`,
    ].join("");

    // Tenta enfileirar via pgmq (padrão do projeto)
    const { error: queueError } = await supabase.rpc("queue_email", {
      p_to: adminEmail,
      p_subject: subject,
      p_html: body,
      p_template: "admin_new_signup",
    });

    if (queueError) {
      moduleLog.error("queue error", queueError);
      // Não bloqueia o signup — apenas registra
      return new Response(
        JSON.stringify({ ok: false, queued: false, error: queueError.message }),
        { status: 200, headers: corsHeaders },
      );
    }

    // Marca dedupe (upsert) — só depois do enqueue bem-sucedido.
    await supabase
      .from("signup_notify_dedupe")
      .upsert({ email, last_sent_at: new Date().toISOString() }, { onConflict: "email" });

    return new Response(
      JSON.stringify({ ok: true, queued: true }),
      { status: 200, headers: corsHeaders },
    );
  } catch (err) {
    moduleLog.error("unexpected error", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: corsHeaders },
    );
  }
});