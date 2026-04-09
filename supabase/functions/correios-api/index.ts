import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
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

      const results: FreteOption[] = [];

      for (const svc of services) {
        try {
          const calcUrl = new URL("http://ws.correios.com.br/calculador/CalcPrecoPrazo.aspx");
          calcUrl.searchParams.set("nCdEmpresa", correiosUser);
          calcUrl.searchParams.set("sDsSenha", correiosPass);
          calcUrl.searchParams.set("nCdServico", svc.codigo);
          calcUrl.searchParams.set("sCepOrigem", cepOrigem);
          calcUrl.searchParams.set("sCepDestino", cepDestino);
          calcUrl.searchParams.set("nVlPeso", String(Math.max(peso, 0.3)));
          calcUrl.searchParams.set("nCdFormato", "1"); // caixa/pacote
          calcUrl.searchParams.set("nVlComprimento", String(comprimento));
          calcUrl.searchParams.set("nVlAltura", String(altura));
          calcUrl.searchParams.set("nVlLargura", String(largura));
          calcUrl.searchParams.set("nVlDiametro", "0");
          calcUrl.searchParams.set("sCdMaoPropria", "N");
          calcUrl.searchParams.set("nVlValorDeclarado", "0");
          calcUrl.searchParams.set("sCdAvisoRecebimento", "N");
          calcUrl.searchParams.set("StrRetorno", "xml");

          const res = await fetch(calcUrl.toString());
          const xml = await res.text();

          // Parse XML response
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
            valor: valor,
            prazo: prazo,
            erro: erro && erro.length > 0 ? erro : undefined,
          });
        } catch (svcErr) {
          results.push({
            servico: svc.nome,
            codigo: svc.codigo,
            valor: 0,
            prazo: 0,
            erro: `Erro ao consultar ${svc.nome}`,
          });
        }
      }

      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Ação não suportada. Use ?action=cotacao_multi" }),
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
