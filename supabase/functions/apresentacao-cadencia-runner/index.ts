import { buildCorsHeaders } from "../_shared/cors.ts";
/**
 * `apresentacao-cadencia-runner` — executa a cadência mensal automática
 * de Apresentação Gerencial.
 *
 * Quando invocada (manualmente ou por pg_cron diário), percorre as
 * configurações ativas em `apresentacao_cadencia` cuja:
 *   - `dia_do_mes` == dia atual (UTC) OU `force=true` no body
 *   - ainda não foram executadas para a competência alvo (mês anterior)
 *
 * Para cada uma:
 *   1. Cria o rascunho em `apresentacao_geracoes` para o mês anterior, na
 *      versão que o mês pede: trimestral em mar/jun/set, anual em dez,
 *      mensal nos demais.
 *   2. Enfileira e-mail para os destinatários com o link da página.
 *   3. Atualiza `ultima_execucao_*` na cadência.
 *
 * O .pptx é gerado no navegador, na página da apresentação, a partir do
 * rascunho (a engine pptxgenjs fica no cliente).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createLogger } from "../_shared/logger.ts";

let corsHeaders: Record<string, string> = buildCorsHeaders(null);
type Versao = "mensal" | "trimestral" | "anual";

/** Mesma regra da página: trimestral em mar/jun/set, anual em dez. */
function versaoDoMes(mes: number): Versao {
  if (mes === 12) return "anual";
  if (mes % 3 === 0) return "trimestral";
  return "mensal";
}

function competenciaAlvo(): { inicial: string; final: string; label: string; versao: Versao } {
  // Mês anterior em horário do Brasil (mesma fonte usada para `today`).
  const nowBrt = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const ref = new Date(nowBrt.getFullYear(), nowBrt.getMonth() - 1, 1);
  const y = ref.getFullYear();
  const m = String(ref.getMonth() + 1).padStart(2, "0");
  return { inicial: `${y}-${m}`, final: `${y}-${m}`, label: `${m}/${y}`, versao: versaoDoMes(ref.getMonth() + 1) };
}

Deno.serve(async (req) => {
  corsHeaders = buildCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const log = createLogger("apresentacao-cadencia-runner", req);

  // 9.5 — M-07: gate via CRON_SECRET (mesmo padrão de process-nfe-retry-cron
  // e process-distdfe-cron). Sem secret configurado a função fica aberta —
  // logamos warn para sinalizar a necessidade de provisionamento.
  const expectedSecret = Deno.env.get("CRON_SECRET")?.trim();
  if (expectedSecret) {
    const url = new URL(req.url);
    const provided =
      req.headers.get("x-cron-secret")?.trim() ||
      url.searchParams.get("cron_secret")?.trim() ||
      "";
    if (provided !== expectedSecret) {
      log.warn("invalid cron secret");
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        { status: 401, headers: corsHeaders },
      );
    }
  } else {
    log.warn("CRON_SECRET ausente — função aberta. Configure o secret no projeto.");
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  let body: { force?: boolean; cadenciaId?: string } = {};
  if (req.method === "POST") {
    try { body = await req.json(); } catch { /* sem body */ }
  }

  // 9.5 — M-07: usa fuso America/Sao_Paulo para alinhar `dia_do_mes` com o
  // calendário brasileiro (evita disparo no dia 31 às 22h BRT que já é dia 1
  // em UTC, ou perda de execução no dia 1 entre 00–03h BRT).
  const nowBrt = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const today = nowBrt.getDate();
  const competencia = competenciaAlvo();
  const appUrl = Deno.env.get("APP_URL") ?? "";

  let query = supabase.from("apresentacao_cadencia").select("*").eq("ativo", true);
  if (body.cadenciaId) query = query.eq("id", body.cadenciaId);
  else if (!body.force) query = query.eq("dia_do_mes", today);

  const { data: cadencias, error } = await query;
  if (error) {
    log.error("listing cadencias failed", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: corsHeaders });
  }
  log.info("cadencias loaded", { count: cadencias?.length ?? 0, force: !!body.force, cadenciaId: body.cadenciaId ?? null });

  const resultados: Array<Record<string, unknown>> = [];

  for (const cad of cadencias ?? []) {
    try {
      // Um só rascunho por competência + versão. Se outra cadência (ou alguém
      // na página) já criou, reaproveita e só avisa os destinatários desta.
      const { data: daCompetencia } = await supabase
        .from("apresentacao_geracoes")
        .select("id, cadencia_id")
        .eq("competencia", competencia.inicial)
        .eq("versao", competencia.versao)
        .order("created_at", { ascending: false });
      const registros = (daCompetencia ?? []) as Array<{ id: string; cadencia_id: string | null }>;
      const existente = registros[0];

      // Idempotência por cadência: esta cadência já criou ou já avisou sobre um rascunho da competência?
      const jaAvisado = registros.find((r) => r.cadencia_id === cad.id || r.id === cad.ultima_execucao_geracao_id);
      if (jaAvisado) {
        resultados.push({ cadencia_id: cad.id, status: "ja_existe", geracao_id: jaAvisado.id });
        continue;
      }

      let geracaoId = existente?.id;
      if (!geracaoId) {
        const { data: geracao, error: insertError } = await supabase
          .from("apresentacao_geracoes")
          .insert({
            template_id: null,
            cadencia_id: cad.id,
            competencia: competencia.inicial,
            versao: competencia.versao,
            competencia_inicial: `${competencia.inicial}-01`,
            competencia_final: `${competencia.final}-01`,
            modo_geracao: "fechado",
            status: "concluido",
            status_editorial: "rascunho",
            is_final: false,
            slides_json: { edicoes: {} },
            parametros_json: { competencia: competencia.inicial, versao: competencia.versao, modelo: "fechamento_v3" },
            observacoes: `Rascunho automático criado pela geração automática "${cad.nome}".`,
          })
          .select("id")
          .single();
        if (insertError) throw insertError;
        geracaoId = geracao.id as string;
      }

      // E-mail para aprovadores
      const destinatarios = (cad.destinatarios_emails ?? []).filter(Boolean);
      const subject = `Apresentação de fechamento ${competencia.label} (${competencia.versao}) pronta para revisar`;
      const html = [
        `<p>O rascunho da apresentação de fechamento de <strong>${competencia.label}</strong> está pronto.</p>`,
        `<p>Versão: <strong>${competencia.versao}</strong>.</p>`,
        `<p>Acesse <a href="${appUrl}/relatorios/apresentacao-gerencial">Apresentação de fechamento</a> para revisar os textos, baixar o .pptx e marcar a versão final.</p>`,
      ].join("");

      for (const to of destinatarios) {
        const { error: queueError } = await supabase.rpc("queue_email", {
          p_to: to,
          p_subject: subject,
          p_html: html,
          p_template: "apresentacao_cadencia",
        });
        if (queueError) log.error("queue_email failed", { to, error: queueError });
      }

      await supabase
        .from("apresentacao_cadencia")
        .update({
          ultima_execucao_em: new Date().toISOString(),
          ultima_execucao_status: "ok",
          ultima_execucao_geracao_id: geracaoId,
        })
        .eq("id", cad.id);

      resultados.push({ cadencia_id: cad.id, status: existente ? "reaproveitado" : "criado", geracao_id: geracaoId, destinatarios: destinatarios.length });
    } catch (err) {
      log.error("cadencia processing failed", { cadencia_id: cad.id, error: err instanceof Error ? err.message : String(err) });
      await supabase
        .from("apresentacao_cadencia")
        .update({
          ultima_execucao_em: new Date().toISOString(),
          ultima_execucao_status: `erro: ${err instanceof Error ? err.message : String(err)}`,
        })
        .eq("id", cad.id);
      resultados.push({ cadencia_id: cad.id, status: "erro", error: String(err) });
    }
  }

  return new Response(JSON.stringify({ ok: true, competencia: competencia.label, total: resultados.length, resultados }), { status: 200, headers: corsHeaders });
});