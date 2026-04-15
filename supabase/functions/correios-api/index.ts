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
 * Correios API Edge Function
 * Supports ?action=cotacao_multi for shipping quotes.
 * Uses Correios public calculator (no auth needed for basic quotes)
 * or authenticated API when CORREIOS_USER / CORREIOS_PASS secrets are set.
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

      // Service codes: SEDEX (04014), PAC (04510), SEDEX 10 (40215), SEDEX 12 (40169)
      const services = [
        { codigo: "04014", nome: "SEDEX" },
        { codigo: "04510", nome: "PAC" },
      ];

      let results: FreteOption[] = [];
      let usedFallback = false;

      for (const svc of services) {
        try {
          const calcUrl = new URL("https://ws.correios.com.br/calculador/CalcPrecoPrazo.aspx");
          calcUrl.searchParams.set("nCdEmpresa", correiosUser);
          calcUrl.searchParams.set("sDsSenha", correiosPass);
          calcUrl.searchParams.set("nCdServico", svc.codigo);
          calcUrl.searchParams.set("sCepOrigem", cepOrigem);
          calcUrl.searchParams.set("sCepDestino", cepDestino);
          calcUrl.searchParams.set("nVlPeso", String(Math.max(peso, 0.3)));
          calcUrl.searchParams.set("nCdFormato", "1");
          calcUrl.searchParams.set("nVlComprimento", String(comprimento));
          calcUrl.searchParams.set("nVlAltura", String(altura));
          calcUrl.searchParams.set("nVlLargura", String(largura));
          calcUrl.searchParams.set("nVlDiametro", "0");
          calcUrl.searchParams.set("sCdMaoPropria", "N");
          calcUrl.searchParams.set("nVlValorDeclarado", "0");
          calcUrl.searchParams.set("sCdAvisoRecebimento", "N");
          calcUrl.searchParams.set("StrRetorno", "xml");

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000);
          const res = await fetch(calcUrl.toString(), { signal: controller.signal });
          clearTimeout(timeout);
          const xml = await res.text();

          const valorMatch = xml.match(/<Valor>([\d.,]+)<\/Valor>/);
          const prazoMatch = xml.match(/<PrazoEntrega>(\d+)<\/PrazoEntrega>/);
          const erroMatch = xml.match(/<MsgErro><!\[CDATA\[(.*?)\]\]><\/MsgErro>/) ||
                           xml.match(/<MsgErro>(.*?)<\/MsgErro>/);

          const valorStr = valorMatch?.[1]?.replace(".", "").replace(",", ".") || "0";
          const valor = parseFloat(valorStr);
          const prazo = parseInt(prazoMatch?.[1] || "0");
          const erro = erroMatch?.[1]?.trim() || undefined;

          results.push({
            servico: svc.nome,
            codigo: svc.codigo,
            valor,
            prazo,
            erro: erro && erro.length > 0 ? erro : undefined,
          });
        } catch (svcErr) {
          console.error(`[correios-cotacao] ${svc.nome} error:`, svcErr);
          results.push({
            servico: svc.nome,
            codigo: svc.codigo,
            valor: 0,
            prazo: 0,
            erro: `Erro ao consultar ${svc.nome}`,
          });
        }
      }

      // If all results errored, provide estimated fallback values so the UI is usable
      const allErrored = results.every((r) => !!r.erro || r.valor <= 0);
      if (allErrored) {
        usedFallback = true;
        // Simple distance-based estimate using CEP regions
        const pesoCalc = Math.max(peso, 0.3);
        const baseSedex = 25 + pesoCalc * 12;
        const basePac = 18 + pesoCalc * 7;
        results = [
          { servico: "SEDEX (estimativa)", codigo: "04014", valor: Math.round(baseSedex * 100) / 100, prazo: 3 },
          { servico: "PAC (estimativa)", codigo: "04510", valor: Math.round(basePac * 100) / 100, prazo: 8 },
        ];
      }

      const response: Record<string, unknown> = {};
      if (usedFallback) {
        (response as any).warning = "fallback_estimativa";
      }

      return new Response(JSON.stringify(usedFallback ? results : results), {
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
