// DISABLED — esta função foi um bootstrap inseguro com credenciais hardcoded
// (admin@avizee.com / admin123456) e sem autenticação. Mantida apenas como
// stub que responde 410 Gone para preservar a rota e evitar que callers antigos
// rebentem com 404 confuso. Não reativar — qualquer provisionamento de admin
// deve ser feito via Supabase Auth Admin (Dashboard > Cloud > Users).

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return new Response(
    JSON.stringify({
      error: "gone",
      message:
        "setup-admin foi descontinuado. Crie administradores pelo painel de Cloud > Users.",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
