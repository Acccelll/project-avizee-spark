// Edge Function: ia-extracao-documento
//
// Recebe um arquivo (PDF/JPG/PNG) em base64 enviado pelo usuário autenticado
// e devolve campos estruturados (boleto, nota fiscal ou extrato) via
// Lovable AI Gateway (Gemini multimodal). NÃO grava nada — apenas extrai.
//
// Padrão idêntico aos outros edge functions do projeto:
//   - buildCorsHeaders + tratamento de OPTIONS
//   - createLogger + sanitizeForLog
//   - SUPABASE_SERVICE_ROLE_KEY para validar JWT do chamador

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import { sanitizeForLog } from "../_shared/sanitize.ts";
import { fetchWithTimeout, isTimeoutError, timeoutResponse } from "../_shared/validate.ts";

type TipoExtracao = "boleto" | "nota" | "extrato";

interface ReqBody {
  tipo: TipoExtracao;
  arquivo_base64: string;
  media_type: string;
}

const MAX_DECODED_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MEDIA = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

const SCHEMA_INSTRUCTIONS: Record<TipoExtracao, string> = {
  boleto: `Extraia campos de UM BOLETO BANCÁRIO BRASILEIRO e responda SOMENTE com JSON válido neste formato exato:
{"valor": number|null, "data_vencimento": "YYYY-MM-DD"|null, "beneficiario_nome": string|null, "beneficiario_documento": string|null, "linha_digitavel": string|null, "nosso_numero": string|null, "confianca": "alta"|"media"|"baixa"}`,
  nota: `Extraia campos de UMA NOTA FISCAL (NF-e/NFS-e) brasileira e responda SOMENTE com JSON válido neste formato exato:
{"valor_total": number|null, "data_emissao": "YYYY-MM-DD"|null, "fornecedor_nome": string|null, "fornecedor_documento": string|null, "numero": string|null, "serie": string|null, "chave_acesso": string|null, "confianca": "alta"|"media"|"baixa"}`,
  extrato: `Extraia os LANÇAMENTOS de um EXTRATO BANCÁRIO e responda SOMENTE com JSON válido neste formato exato:
{"lancamentos": [{"data": "YYYY-MM-DD", "descricao": string, "valor": number, "tipo": "credito"|"debito"}], "confianca": "alta"|"media"|"baixa"}`,
};

function decodeBase64Length(b64: string): number {
  // Aproxima o tamanho decodificado sem alocar buffer.
  const len = b64.length;
  if (len === 0) return 0;
  let padding = 0;
  if (b64.endsWith("==")) padding = 2;
  else if (b64.endsWith("=")) padding = 1;
  return Math.floor((len * 3) / 4) - padding;
}

function extractJsonFromText(raw: string): unknown {
  let txt = raw.trim();
  // Remove cercas markdown ```json ... ``` ou ``` ... ```
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;
  const m = txt.match(fence);
  if (m) txt = m[1].trim();
  // Se houver lixo antes/depois, recorta do primeiro { ao último }
  const first = txt.indexOf("{");
  const last = txt.lastIndexOf("}");
  if (first >= 0 && last > first) txt = txt.slice(first, last + 1);
  return JSON.parse(txt);
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const log = createLogger("ia-extracao-documento", req);
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ erro: "Método não permitido." }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  // ── Auth ────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return new Response(JSON.stringify({ erro: "Sessão ausente." }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    log.error("missing supabase env");
    return new Response(
      JSON.stringify({ erro: "Configuração do servidor incompleta." }),
      { status: 500, headers: jsonHeaders },
    );
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ erro: "Sessão inválida." }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  // ── Secret do Gateway ───────────────────────────────────────────────────
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) {
    return new Response(
      JSON.stringify({
        erro:
          "IA não configurada neste ambiente. Habilite o Lovable AI Gateway para usar a extração automática.",
      }),
      { status: 503, headers: jsonHeaders },
    );
  }

  // ── Body ────────────────────────────────────────────────────────────────
  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return new Response(JSON.stringify({ erro: "JSON inválido." }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const tipo = body?.tipo;
  const arquivoBase64 = String(body?.arquivo_base64 ?? "").trim();
  const mediaType = String(body?.media_type ?? "").toLowerCase();

  if (!tipo || !["boleto", "nota", "extrato"].includes(tipo)) {
    return new Response(
      JSON.stringify({ erro: "Campo 'tipo' deve ser 'boleto', 'nota' ou 'extrato'." }),
      { status: 400, headers: jsonHeaders },
    );
  }
  if (!arquivoBase64) {
    return new Response(JSON.stringify({ erro: "Arquivo ausente." }), {
      status: 400,
      headers: jsonHeaders,
    });
  }
  if (!ALLOWED_MEDIA.has(mediaType)) {
    return new Response(
      JSON.stringify({ erro: `media_type não suportado (${mediaType}).` }),
      { status: 400, headers: jsonHeaders },
    );
  }
  const decodedBytes = decodeBase64Length(arquivoBase64);
  if (decodedBytes > MAX_DECODED_BYTES) {
    return new Response(
      JSON.stringify({
        erro: `Arquivo muito grande (${(decodedBytes / 1024 / 1024).toFixed(1)} MB). Limite: 10 MB.`,
      }),
      { status: 413, headers: jsonHeaders },
    );
  }

  // ── Monta a chamada multimodal ao Lovable AI Gateway ───────────────────
  // OpenAI-compatible /v1/chat/completions com content blocks.
  const systemPrompt =
    "Você é um extrator estrito de campos de documentos financeiros brasileiros. " +
    "Responda EXCLUSIVAMENTE com JSON válido, sem markdown, sem comentários, sem texto antes/depois. " +
    "Datas em ISO YYYY-MM-DD; valores em ponto decimal (123.45). " +
    "Quando um campo não estiver visível ou for ilegível, retorne null para esse campo. " +
    "Classifique sua própria confiança em 'alta', 'media' ou 'baixa'.";

  const userText = SCHEMA_INSTRUCTIONS[tipo];

  const dataUrl = `data:${mediaType};base64,${arquivoBase64}`;

  // Gemini (via Lovable AI Gateway) aceita PDF e imagens como image_url
  // com data URL. Funciona para application/pdf também.
  const messages = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: [
        { type: "text", text: userText },
        { type: "image_url", image_url: { url: dataUrl } },
      ],
    },
  ];

  log.info("extracao request", sanitizeForLog({
    tipo,
    media_type: mediaType,
    bytes: decodedBytes,
    user_id: userData.user.id,
  }));

  let gatewayResp: Response;
  try {
    gatewayResp = await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": lovableKey,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        max_tokens: 1500,
        temperature: 0,
      }),
    }, 60_000);
  } catch (e) {
    if (isTimeoutError(e)) {
      log.warn("gateway timeout", { url: e.url, ms: e.ms });
      return timeoutResponse(corsHeaders, "IA demorou demais para responder");
    }
    log.error("gateway fetch failed", e);
    return new Response(
      JSON.stringify({ erro: "Falha ao contatar a IA. Tente novamente." }),
      { status: 502, headers: jsonHeaders },
    );
  }

  if (!gatewayResp.ok) {
    const text = await gatewayResp.text();
    log.warn("gateway error", { status: gatewayResp.status, sample: text.slice(0, 300) });
    if (gatewayResp.status === 429) {
      return new Response(
        JSON.stringify({ erro: "Limite de requisições atingido. Aguarde alguns segundos e tente novamente." }),
        { status: 429, headers: jsonHeaders },
      );
    }
    if (gatewayResp.status === 402) {
      return new Response(
        JSON.stringify({ erro: "Créditos de IA esgotados. Recarregue na área de billing do workspace." }),
        { status: 402, headers: jsonHeaders },
      );
    }
    return new Response(
      JSON.stringify({ erro: `IA retornou erro (${gatewayResp.status}).` }),
      { status: 502, headers: jsonHeaders },
    );
  }

  type ChatCompletion = {
    choices?: Array<{ message?: { content?: string } }>;
  };
  let parsed: ChatCompletion;
  try {
    parsed = (await gatewayResp.json()) as ChatCompletion;
  } catch {
    return new Response(
      JSON.stringify({ erro: "Resposta da IA não pôde ser interpretada." }),
      { status: 502, headers: jsonHeaders },
    );
  }

  const raw = parsed?.choices?.[0]?.message?.content ?? "";
  if (!raw) {
    return new Response(
      JSON.stringify({ erro: "IA não retornou conteúdo." }),
      { status: 502, headers: jsonHeaders },
    );
  }

  let dados: Record<string, unknown>;
  try {
    dados = extractJsonFromText(raw) as Record<string, unknown>;
  } catch {
    log.warn("json parse failed", { sample: raw.slice(0, 300) });
    return new Response(
      JSON.stringify({
        erro: "Não foi possível interpretar o documento.",
        raw: raw.slice(0, 500),
      }),
      { status: 422, headers: jsonHeaders },
    );
  }

  const confianca = typeof dados?.confianca === "string" ? dados.confianca : "media";

  log.info("extracao ok", sanitizeForLog({ tipo, confianca, keys: Object.keys(dados) }));

  return new Response(
    JSON.stringify({ sucesso: true, tipo, dados, confianca }),
    { status: 200, headers: jsonHeaders },
  );
});