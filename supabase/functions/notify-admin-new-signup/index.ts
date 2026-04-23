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
      console.error("[notify-admin-new-signup] queue error", queueError);
      // Não bloqueia o signup — apenas registra
      return new Response(
        JSON.stringify({ ok: false, queued: false, error: queueError.message }),
        { status: 200, headers: corsHeaders },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, queued: true }),
      { status: 200, headers: corsHeaders },
    );
  } catch (err) {
    console.error("[notify-admin-new-signup] error", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: corsHeaders },
    );
  }
});