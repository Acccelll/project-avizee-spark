// Edge Function: ia-sugestao
//
// Acoes:
//   - "categorizar"       → sugere conta_contabil_id + centro_custo_id para um lançamento
//   - "conciliar"         → escolhe o melhor par entre uma transação de extrato e candidatos
//   - "explicar_anomalia" → explica em texto curto por que algo é suspeito

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import { sanitizeForLog } from "../_shared/sanitize.ts";
import { fetchWithTimeout, isTimeoutError, timeoutResponse } from "../_shared/validate.ts";
import { checkRateLimit, rateLimitKey, rateLimitResponse } from "../_shared/rate-limit.ts";

type Acao = "categorizar" | "conciliar" | "explicar_anomalia";

interface ReqCategorizar {
  acao: "categorizar";
  descricao: string;
  valor: number;
  fornecedor_nome?: string | null;
  tipo?: "pagar" | "receber";
}

interface CandidatoConciliacao {
  id: string;
  descricao: string | null;
  valor: number;
  data_vencimento: string;
  data_baixa?: string | null;
}
interface ReqConciliar {
  acao: "conciliar";
  transacao: { id: string; descricao: string; valor: number; data: string };
  candidatos: CandidatoConciliacao[];
}

interface ReqExplicar {
  acao: "explicar_anomalia";
  tipo_anomalia: "divergencia_preco" | "nf_duplicada" | "gasto_fora_padrao" | "duplicidade";
  dados: Record<string, unknown>;
}

type ReqBody = ReqCategorizar | ReqConciliar | ReqExplicar;

function extractJsonFromText(raw: string): unknown {
  let txt = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;
  const m = txt.match(fence);
  if (m) txt = m[1].trim();
  const first = txt.indexOf("{");
  const last = txt.lastIndexOf("}");
  if (first >= 0 && last > first) txt = txt.slice(first, last + 1);
  return JSON.parse(txt);
}

async function callGateway(lovableKey: string, messages: unknown[], wantJson: boolean) {
  return await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": lovableKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages,
      max_tokens: wantJson ? 600 : 250,
      temperature: 0,
    }),
  }, 60_000);
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const log = createLogger("ia-sugestao", req);
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ erro: "Método não permitido." }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  // ── Auth ──
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return new Response(JSON.stringify({ erro: "Sessão ausente." }), {
      status: 401,
      headers: jsonHeaders,
    });
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ erro: "Configuração do servidor incompleta." }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ erro: "Sessão inválida." }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const rl = checkRateLimit(rateLimitKey(req, userData.user.id), {
    scope: "ia-sugestao",
    limit: 60,
    windowSec: 60,
  });
  if (!rl.ok) return rateLimitResponse(rl, jsonHeaders);

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) {
    return new Response(
      JSON.stringify({ erro: "IA não configurada neste ambiente." }),
      { status: 503, headers: jsonHeaders },
    );
  }

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return new Response(JSON.stringify({ erro: "JSON inválido." }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const acao = body?.acao as Acao;
  if (!acao) {
    return new Response(JSON.stringify({ erro: "Campo 'acao' obrigatório." }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  try {
    // ─────────────────────────── CATEGORIZAR ─────────────────────────────
    if (acao === "categorizar") {
      const b = body as ReqCategorizar;
      const descricao = String(b.descricao ?? "").trim();
      if (!descricao) {
        return new Response(JSON.stringify({ erro: "Descrição obrigatória." }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      // Pré-filtro: similaridade ILIKE no histórico — barato e direcionado.
      // Pega top 30 lançamentos já categorizados parecidos com a descrição.
      const tokens = descricao
        .toLowerCase()
        .normalize("NFD")
        // eslint-disable-next-line no-misleading-character-class
        .replace(/[\u0300-\u036f]/g, "")
        .split(/\s+/)
        .filter((t) => t.length >= 3)
        .slice(0, 4);

      let historico: Array<{
        descricao: string | null;
        conta_contabil_id: string | null;
        centro_custo_id: string | null;
      }> = [];

      const baseQuery = supabase
        .from("financeiro_lancamentos")
        .select("descricao, conta_contabil_id, centro_custo_id")
        .not("conta_contabil_id", "is", null)
        .order("created_at", { ascending: false });

      if (tokens.length > 0) {
        // Tenta primeiro com OR de ILIKE em qualquer token
        const orExpr = tokens.map((t) => `descricao.ilike.%${t}%`).join(",");
        const { data, error } = await baseQuery.or(orExpr).limit(30);
        if (!error && data) historico = data;
      }
      if (historico.length === 0) {
        const { data } = await baseQuery.limit(30);
        historico = data ?? [];
      }

      // Contas contábeis válidas (catálogo enxuto)
      const { data: contas } = await supabase
        .from("contas_contabeis")
        .select("id, codigo, descricao, ativo")
        .eq("ativo", true)
        .order("codigo")
        .limit(200);

      const { data: centros } = await supabase
        .from("centros_custo")
        .select("id, codigo, descricao, ativo")
        .eq("ativo", true)
        .order("codigo")
        .limit(100);

      const idsContasValidas = new Set((contas ?? []).map((c) => c.id));
      const idsCentrosValidos = new Set((centros ?? []).map((c) => c.id));

      const examplesText = historico
        .filter((h) => h.descricao && h.conta_contabil_id)
        .slice(0, 30)
        .map((h) => `- "${h.descricao}" → conta=${h.conta_contabil_id}${h.centro_custo_id ? `, centro=${h.centro_custo_id}` : ""}`)
        .join("\n");

      const contasCatalogo = (contas ?? [])
        .slice(0, 80)
        .map((c) => `${c.id} | ${c.codigo} | ${c.descricao}`)
        .join("\n");
      const centrosCatalogo = (centros ?? [])
        .map((c) => `${c.id} | ${c.codigo} | ${c.descricao}`)
        .join("\n");

      const messages = [
        {
          role: "system",
          content:
            "Você classifica lançamentos financeiros em conta contábil e centro de custo. " +
            "RESPONDA SOMENTE JSON. Escolha IDs APENAS dos catálogos fornecidos; se não tiver certeza, retorne null. " +
            'Formato: {"conta_contabil_id": string|null, "centro_custo_id": string|null, "justificativa": string, "confianca": "alta"|"media"|"baixa"}',
        },
        {
          role: "user",
          content:
            `Lançamento a classificar:\n- descrição: "${descricao}"\n- valor: ${b.valor}\n- fornecedor: ${b.fornecedor_nome ?? "(sem fornecedor)"}\n- tipo: ${b.tipo ?? "pagar"}\n\n` +
            `Histórico de classificações parecidas (use como guia):\n${examplesText || "(sem histórico)"}\n\n` +
            `Catálogo de contas contábeis válidas (id | código | descrição):\n${contasCatalogo || "(vazio)"}\n\n` +
            `Catálogo de centros de custo válidos:\n${centrosCatalogo || "(vazio)"}`,
        },
      ];

      const resp = await callGateway(lovableKey, messages, true);
      if (!resp.ok) {
        const t = await resp.text();
        log.warn("gateway error categorizar", { status: resp.status, sample: t.slice(0, 200) });
        return new Response(
          JSON.stringify({ erro: `IA indisponível (${resp.status}).` }),
          { status: resp.status === 402 ? 402 : 502, headers: jsonHeaders },
        );
      }
      const raw = (await resp.json())?.choices?.[0]?.message?.content ?? "";
      let dados: Record<string, unknown>;
      try {
        dados = extractJsonFromText(raw) as Record<string, unknown>;
      } catch {
        return new Response(JSON.stringify({ erro: "Resposta da IA inválida." }), {
          status: 422,
          headers: jsonHeaders,
        });
      }

      // Valida que os IDs existem
      const contaId = typeof dados.conta_contabil_id === "string" ? dados.conta_contabil_id : null;
      const centroId = typeof dados.centro_custo_id === "string" ? dados.centro_custo_id : null;
      const safeConta = contaId && idsContasValidas.has(contaId) ? contaId : null;
      const safeCentro = centroId && idsCentrosValidos.has(centroId) ? centroId : null;

      return new Response(
        JSON.stringify({
          sucesso: true,
          conta_contabil_id: safeConta,
          centro_custo_id: safeCentro,
          justificativa: typeof dados.justificativa === "string" ? dados.justificativa : "",
          confianca: typeof dados.confianca === "string" ? dados.confianca : "baixa",
        }),
        { status: 200, headers: jsonHeaders },
      );
    }

    // ─────────────────────────── CONCILIAR ───────────────────────────────
    if (acao === "conciliar") {
      const b = body as ReqConciliar;
      if (!b.transacao || !Array.isArray(b.candidatos) || b.candidatos.length === 0) {
        return new Response(JSON.stringify({ erro: "Transação e candidatos obrigatórios." }), {
          status: 400,
          headers: jsonHeaders,
        });
      }
      const idsValidos = new Set(b.candidatos.map((c) => c.id));
      const candidatosText = b.candidatos
        .slice(0, 20)
        .map(
          (c, i) =>
            `${i + 1}. id=${c.id} | valor=${c.valor} | venc=${c.data_vencimento} | baixa=${c.data_baixa ?? "—"} | desc="${(c.descricao ?? "").slice(0, 80)}"`,
        )
        .join("\n");

      const messages = [
        {
          role: "system",
          content:
            "Você concilia transações bancárias com lançamentos do ERP. RESPONDA SOMENTE JSON. " +
            "Escolha o lançamento_id APENAS entre os candidatos fornecidos; se nenhum parecer adequado, retorne null. " +
            'Formato: {"lancamento_id": string|null, "justificativa": string, "confianca": "alta"|"media"|"baixa"}',
        },
        {
          role: "user",
          content:
            `Transação do extrato:\n- data: ${b.transacao.data}\n- valor: ${b.transacao.valor}\n- descrição: "${b.transacao.descricao}"\n\n` +
            `Candidatos:\n${candidatosText}`,
        },
      ];
      const resp = await callGateway(lovableKey, messages, true);
      if (!resp.ok) {
        return new Response(
          JSON.stringify({ erro: `IA indisponível (${resp.status}).` }),
          { status: resp.status === 402 ? 402 : 502, headers: jsonHeaders },
        );
      }
      const raw = (await resp.json())?.choices?.[0]?.message?.content ?? "";
      let dados: Record<string, unknown>;
      try {
        dados = extractJsonFromText(raw) as Record<string, unknown>;
      } catch {
        return new Response(JSON.stringify({ erro: "Resposta da IA inválida." }), {
          status: 422,
          headers: jsonHeaders,
        });
      }
      const escolhido = typeof dados.lancamento_id === "string" ? dados.lancamento_id : null;
      const safe = escolhido && idsValidos.has(escolhido) ? escolhido : null;
      return new Response(
        JSON.stringify({
          sucesso: true,
          lancamento_id: safe,
          justificativa: typeof dados.justificativa === "string" ? dados.justificativa : "",
          confianca: typeof dados.confianca === "string" ? dados.confianca : "baixa",
        }),
        { status: 200, headers: jsonHeaders },
      );
    }

    // ─────────────────────── EXPLICAR ANOMALIA ───────────────────────────
    if (acao === "explicar_anomalia") {
      const b = body as ReqExplicar;
      const messages = [
        {
          role: "system",
          content:
            "Você explica em UMA frase curta (máx 240 caracteres) por que uma anomalia detectada em sistema ERP é suspeita. " +
            "Tom: objetivo, brasileiro, sem markdown.",
        },
        {
          role: "user",
          content: `Tipo: ${b.tipo_anomalia}\nDados:\n${JSON.stringify(b.dados, null, 2)}`,
        },
      ];
      const resp = await callGateway(lovableKey, messages, false);
      if (!resp.ok) {
        return new Response(
          JSON.stringify({ erro: `IA indisponível (${resp.status}).` }),
          { status: resp.status === 402 ? 402 : 502, headers: jsonHeaders },
        );
      }
      const raw = (await resp.json())?.choices?.[0]?.message?.content ?? "";
      return new Response(
        JSON.stringify({ sucesso: true, explicacao: String(raw).trim().slice(0, 500) }),
        { status: 200, headers: jsonHeaders },
      );
    }

    return new Response(JSON.stringify({ erro: "Ação desconhecida." }), {
      status: 400,
      headers: jsonHeaders,
    });
  } catch (e) {
    if (isTimeoutError(e)) {
      log.warn("gateway timeout", { url: e.url, ms: e.ms });
      return timeoutResponse(corsHeaders, "IA demorou demais para responder");
    }
    log.error("unexpected", e);
    return new Response(
      JSON.stringify({ erro: "Erro inesperado processando a sugestão." }),
      { status: 500, headers: jsonHeaders },
    );
  }
});