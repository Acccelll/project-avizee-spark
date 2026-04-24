import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CotacaoRequest {
  cepOrigem: string;
  cepDestino: string;
  peso: number;
  comprimento?: number;
  altura?: number;
  largura?: number;
}

interface FreteOption {
  servico: string;
  codigo: string;
  valor: number;
  prazo: number;
  erro?: string;
}

/**
 * Authenticate against the modern Correios REST API using a CWS Access Key
 * (Chave de Acesso). The Access Key authorizes /token/v1/autentica/contrato,
 * which returns a Bearer token usable on /preco/v2 and /prazo/v1 endpoints.
 *
 * Fallback: if only legacy USER/PASS are present, try Basic Auth.
 */
async function autenticarCorreios(opts: {
  apiKey?: string;
  contrato?: string;
  cartao?: string;
  user?: string;
  pass?: string;
}): Promise<string | null> {
  const { apiKey, contrato, cartao, user, pass } = opts;

  // Preferred: CWS Access Key flow (Basic Auth where user = CORREIOS_USER and pass = Access Key).
  // The Correios gateway returns "GTW-014 ... Utilize 'Authorization: Basic'" when Bearer is sent.
  if (apiKey && user) {
    const basicKey = btoa(`${user}:${apiKey}`);
    const attempts: Array<{ url: string; body: Record<string, string> }> = [];
    if (contrato) {
      attempts.push({
        url: "https://api.correios.com.br/token/v1/autentica/contrato",
        body: { numero: contrato, ...(cartao ? { cartaoPostagem: cartao } : {}) },
      });
    }
    if (cartao) {
      attempts.push({
        url: "https://api.correios.com.br/token/v1/autentica/cartaopostagem",
        body: { numero: cartao },
      });
    }
    attempts.push({ url: "https://api.correios.com.br/token/v1/autentica", body: {} });

    for (const ep of attempts) {
      try {
        const res = await fetch(ep.url, {
          method: "POST",
          headers: {
            Authorization: `Basic ${basicKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: Object.keys(ep.body).length ? JSON.stringify(ep.body) : undefined,
        });
        const txt = await res.text();
        if (!res.ok) {
          console.warn(`[correios-auth-key] ${ep.url} → ${res.status}: ${txt.slice(0, 300)}`);
          continue;
        }
        const data = JSON.parse(txt);
        if (data?.token) {
          console.log(`[correios-auth-key] OK via ${ep.url}`);
          return data.token as string;
        }
      } catch (e) {
        console.warn(`[correios-auth-key] ${ep.url} threw`, e);
      }
    }
  }

  // Legacy fallback: Basic Auth (user + senha de componente)
  if (user && pass) {
    const basic = btoa(`${user}:${pass}`);
    const legacyEndpoints: Array<{ url: string; body: Record<string, string> | null }> = [
      { url: "https://api.correios.com.br/token/v1/autentica/cartaopostagem", body: cartao ? { numero: cartao } : null },
      { url: "https://api.correios.com.br/token/v1/autentica", body: null },
    ];
    for (const ep of legacyEndpoints) {
      try {
        const res = await fetch(ep.url, {
          method: "POST",
          headers: {
            Authorization: `Basic ${basic}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: ep.body ? JSON.stringify(ep.body) : undefined,
        });
        if (!res.ok) {
          const txt = await res.text();
          console.warn(`[correios-auth-legacy] ${ep.url} → ${res.status}: ${txt.slice(0, 200)}`);
          continue;
        }
        const data = await res.json();
        if (data?.token) return data.token as string;
      } catch (e) {
        console.warn(`[correios-auth-legacy] ${ep.url} threw`, e);
      }
    }
  }

  return null;
}

/**
 * Correios API Edge Function
 * Supports ?action=cotacao_multi for shipping quotes.
 * Uses the modern Correios REST API (api.correios.com.br) — the legacy
 * CalcPrecoPrazo SOAP endpoint was discontinued in 2024.
 * Requires CORREIOS_USER / CORREIOS_PASS (and optionally CORREIOS_CARTAO_POSTAGEM).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "cotacao_multi" && req.method === "POST") {
      const body: CotacaoRequest = await req.json();
      const { cepOrigem, cepDestino, peso, comprimento = 30, altura = 15, largura = 10 } = body;

      if (!cepOrigem || !cepDestino || !peso) {
        return new Response(
          JSON.stringify({ error: "cepOrigem, cepDestino e peso são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const correiosUser = Deno.env.get("CORREIOS_USER") || "";
      const correiosPass = Deno.env.get("CORREIOS_PASS") || "";
      const cartaoPostagem = Deno.env.get("CORREIOS_CARTAO_POSTAGEM") || "";
      const apiKey = Deno.env.get("CORREIOS_API_KEY") || "";
      const contrato = Deno.env.get("CORREIOS_CONTRATO") || "";

      const services = [
        { codigo: "03220", nome: "SEDEX" },   // SEDEX CONTRATO AG
        { codigo: "03298", nome: "PAC" },     // PAC CONTRATO AG
        { codigo: "04014", nome: "SEDEX" },   // fallback varejo
        { codigo: "04510", nome: "PAC" },     // fallback varejo
      ];

      let results: FreteOption[] = [];
      let usedFallback = false;
      let authError: string | null = null;

      // 1) Authenticate with modern REST API
      let token: string | null = null;
      if (apiKey || (correiosUser && correiosPass)) {
        token = await autenticarCorreios({
          apiKey: apiKey || undefined,
          contrato: contrato || undefined,
          cartao: cartaoPostagem || undefined,
          user: correiosUser || undefined,
          pass: correiosPass || undefined,
        });
        if (!token) {
          authError = "Falha ao autenticar nos Correios. Verifique CORREIOS_API_KEY, CORREIOS_CONTRATO e CORREIOS_CARTAO_POSTAGEM.";
          console.error("[correios-cotacao]", authError);
        }
      } else {
        authError = "Credenciais dos Correios não configuradas (CORREIOS_API_KEY ou CORREIOS_USER/CORREIOS_PASS).";
      }

      if (token) {
        const pesoGramas = Math.max(Math.round(peso * 1000), 300);
        const seen = new Set<string>();
        for (const svc of services) {
          if (seen.has(svc.nome)) continue; // já obtido por código contratado
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            // Preço
            const precoRes = await fetch("https://api.correios.com.br/preco/v2/nacional", {
              method: "POST",
              signal: controller.signal,
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({
                idLote: "1",
                parametrosProduto: [
                  {
                    coProduto: svc.codigo,
                    cepOrigem,
                    cepDestino,
                    psObjeto: String(pesoGramas),
                    tpObjeto: "2", // pacote
                    comprimento: String(comprimento),
                    largura: String(largura),
                    altura: String(altura),
                    ...(cartaoPostagem ? { nuContrato: cartaoPostagem } : {}),
                  },
                ],
              }),
            });
            const precoData = await precoRes.json();
            const precoItem = Array.isArray(precoData) ? precoData[0] : precoData?.[0] ?? precoData;
            clearTimeout(timeout);

            if (precoItem?.txErro || precoRes.status >= 400) {
              console.warn(`[correios-cotacao] ${svc.nome} preço erro:`, precoItem?.txErro || precoRes.status);
              continue;
            }

            const valorStr = (precoItem?.pcFinal || precoItem?.pcBase || "0").toString().replace(",", ".");
            const valor = parseFloat(valorStr);

            // Prazo
            const prazoRes = await fetch("https://api.correios.com.br/prazo/v1/nacional", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({
                idLote: "1",
                parametrosPrazo: [
                  { coProduto: svc.codigo, cepOrigem, cepDestino, dtEvento: new Date().toISOString().slice(0, 10).replace(/-/g, "/") },
                ],
              }),
            });
            const prazoData = await prazoRes.json();
            const prazoItem = Array.isArray(prazoData) ? prazoData[0] : prazoData?.[0] ?? prazoData;
            const prazo = parseInt(prazoItem?.prazoEntrega || "0", 10) || 0;

            if (valor > 0) {
              results.push({ servico: svc.nome, codigo: svc.codigo, valor, prazo });
              seen.add(svc.nome);
            }
          } catch (svcErr) {
            console.error(`[correios-cotacao] ${svc.nome} error:`, svcErr);
          }
        }
      }

      // If all results errored, provide estimated fallback values so the UI is usable
      const allErrored = results.every((r) => !!r.erro || r.valor <= 0);
      if (allErrored) {
        usedFallback = true;
        const pesoCalc = Math.max(peso, 0.3);
        const baseSedex = 25 + pesoCalc * 12;
        const basePac = 18 + pesoCalc * 7;
        results = [
          { servico: "SEDEX (estimativa)", codigo: "04014", valor: Math.round(baseSedex * 100) / 100, prazo: 3, erro: authError ?? undefined },
          { servico: "PAC (estimativa)", codigo: "04510", valor: Math.round(basePac * 100) / 100, prazo: 8, erro: authError ?? undefined },
        ];
      }

      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "rastrear" && req.method === "GET") {
      const codigo = url.searchParams.get("codigo") || "";
      if (!codigo) {
        return new Response(
          JSON.stringify({ error: "Parâmetro 'codigo' é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const correiosUser = Deno.env.get("CORREIOS_USER") || "";
      const correiosPass = Deno.env.get("CORREIOS_PASS") || "";

      // If no credentials, return mock tracking data
      if (!correiosUser || !correiosPass) {
        const mockData = {
          warning: "fallback_mock",
          data: {
            eventos: [
              { tipo: "BDE", descricao: "Objeto entregue ao destinatário", dtHrCriado: new Date(Date.now() - 86400000).toISOString(), unidade: { nome: "Unidade de Distribuição", endereco: { cidade: "São Paulo" } } },
              { tipo: "OEC", descricao: "Objeto saiu para entrega ao destinatário", dtHrCriado: new Date(Date.now() - 86400000 * 2).toISOString(), unidade: { nome: "Unidade de Distribuição", endereco: { cidade: "São Paulo" } } },
              { tipo: "RO", descricao: "Objeto em trânsito - por favor aguarde", dtHrCriado: new Date(Date.now() - 86400000 * 4).toISOString(), unidade: { nome: "Unidade de Tratamento", endereco: { cidade: "Curitiba" } } },
              { tipo: "PO", descricao: "Objeto postado", dtHrCriado: new Date(Date.now() - 86400000 * 6).toISOString(), unidade: { nome: "Agência dos Correios", endereco: { cidade: "Florianópolis" } } },
            ],
          },
        };
        return new Response(JSON.stringify(mockData), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Authenticate with Correios SRO API
      try {
        // Try Correios public SRO endpoint
        const sroUrl = `https://proxyapp.correios.com.br/v1/sro-rastro/${codigo}`;
        
        // Get auth token
        const authRes = await fetch("https://proxyapp.correios.com.br/v1/autentica/cartaopostagem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ numero: correiosUser, senha: correiosPass }),
        });

        let trackingResult;
        if (authRes.ok) {
          const authData = await authRes.json();
          const tokenCorreios = authData.token;
          const trackRes = await fetch(sroUrl, {
            headers: { Authorization: `Bearer ${tokenCorreios}` },
          });
          trackingResult = await trackRes.json();
        } else {
          // Fallback: try legacy XML endpoint
          const legacyUrl = `http://webservice.correios.com.br/service/rest/rastro/rastroMobile?usuario=${encodeURIComponent(correiosUser)}&senha=${encodeURIComponent(correiosPass)}&tipo=L&resultado=T&objetos=${codigo}&lingua=101&token=`;
          const legacyRes = await fetch(legacyUrl);
          const legacyText = await legacyRes.text();
          // Parse minimal XML
          const objetoMatch = legacyText.match(/<objeto>([\s\S]*?)<\/objeto>/);
          if (objetoMatch) {
            const eventos: unknown[] = [];
            const eventoMatches = legacyText.matchAll(/<evento>([\s\S]*?)<\/evento>/g);
            for (const m of eventoMatches) {
              const descMatch = m[1].match(/<descricao>(.*?)<\/descricao>/);
              const tipoMatch = m[1].match(/<tipo>(.*?)<\/tipo>/);
              const dtMatch = m[1].match(/<data>(.*?)<\/data>/);
              const hrMatch = m[1].match(/<hora>(.*?)<\/hora>/);
              const cidadeMatch = m[1].match(/<cidade>(.*?)<\/cidade>/);
              const localMatch = m[1].match(/<local>(.*?)<\/local>/);
              eventos.push({
                tipo: tipoMatch?.[1] || "",
                descricao: descMatch?.[1] || "",
                dtHrCriado: dtMatch?.[1] && hrMatch?.[1] ? `${dtMatch[1]}T${hrMatch[1]}` : new Date().toISOString(),
                unidade: { nome: localMatch?.[1] || "", endereco: { cidade: cidadeMatch?.[1] || "" } },
              });
            }
            trackingResult = { objetos: [{ eventos }] };
          } else {
            trackingResult = { objetos: [{ eventos: [] }] };
          }
        }

        return new Response(JSON.stringify(trackingResult), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (trackErr: any) {
        console.error("[correios-rastrear] Falling back to mock:", trackErr.message);
        // Network/auth errors → return mock data so the UI still works
        const mockFallback = {
          warning: "fallback_mock",
          data: {
            eventos: [
              { tipo: "BDE", descricao: "Objeto entregue ao destinatário", dtHrCriado: new Date(Date.now() - 86400000).toISOString(), unidade: { nome: "Unidade de Distribuição", endereco: { cidade: "São Paulo" } } },
              { tipo: "OEC", descricao: "Objeto saiu para entrega ao destinatário", dtHrCriado: new Date(Date.now() - 86400000 * 2).toISOString(), unidade: { nome: "Unidade de Distribuição", endereco: { cidade: "São Paulo" } } },
              { tipo: "RO", descricao: "Objeto em trânsito - por favor aguarde", dtHrCriado: new Date(Date.now() - 86400000 * 4).toISOString(), unidade: { nome: "Unidade de Tratamento", endereco: { cidade: "Curitiba" } } },
              { tipo: "PO", descricao: "Objeto postado", dtHrCriado: new Date(Date.now() - 86400000 * 6).toISOString(), unidade: { nome: "Agência dos Correios", endereco: { cidade: "Florianópolis" } } },
            ],
          },
        };
        return new Response(JSON.stringify(mockFallback), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(
      JSON.stringify({ error: "Ação não suportada. Use ?action=cotacao_multi ou ?action=rastrear" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[correios-api]", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
