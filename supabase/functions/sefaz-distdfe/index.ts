// deno-lint-ignore-file no-explicit-any
/**
 * Edge Function: sefaz-distdfe
 *
 * Implementa o serviço NfeDistribuicaoDFe (Ambiente Nacional) para baixar
 * automaticamente NF-e emitidas contra o CNPJ da empresa, sem necessidade de
 * captura manual de chaves.
 *
 * Reutiliza o certificado A1 (.pfx) armazenado em
 *   dbavizee/certificados/empresa.pfx
 * e a senha em CERTIFICADO_PFX_SENHA (Vault).
 *
 * Actions:
 *   - "consultar-nsu": consulta documentos a partir do último NSU recebido
 *   - "consultar-chave": consulta um documento específico por chave de acesso (consChNFe)
 *
 * Endpoint SEFAZ (AN):
 *   - Produção:    https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx
 *   - Homologação: https://hom.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx
 *
 * O endpoint exige mTLS — autenticação por certificado de cliente (A1).
 * Usamos Deno.createHttpClient({ cert, key }) para isso.
 */

import forge from "https://esm.sh/node-forge@1.3.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { gunzipSync } from "https://esm.sh/fflate@0.8.2";
import { createLogger } from "../_shared/logger.ts";

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN");
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin ?? "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function requireAuth(req: Request) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Token de autenticação ausente.");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error("Sessão inválida ou expirada.");
  return data.user;
}

// ── PFX → PEM (cert + chave privada) ─────────────────────────────

function pfxToPem(base64: string, senha: string): { certPem: string; keyPem: string; cnpj: string } {
  const derBytes = forge.util.decode64(base64);
  const asn1 = forge.asn1.fromDer(derBytes);
  const pfx = forge.pkcs12.pkcs12FromAsn1(asn1, senha);

  const keyBags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
  if (!keyBag?.key) throw new Error("Chave privada não encontrada no PFX.");

  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = certBags[forge.pki.oids.certBag]?.[0];
  if (!certBag?.cert) throw new Error("Certificado X.509 não encontrado no PFX.");

  const certPem = forge.pki.certificateToPem(certBag.cert);
  const keyPem = forge.pki.privateKeyToPem(keyBag.key as forge.pki.rsa.PrivateKey);

  // CNPJ — do serialNumber (OID 2.5.4.5)
  let cnpj = "";
  const sn = certBag.cert.subject.getField({ shortName: "serialNumber" });
  if (sn) cnpj = String(sn.value).replace(/\D/g, "");
  if (!cnpj || cnpj.length < 14) {
    const cn = certBag.cert.subject.getField("CN");
    if (cn) {
      const m = String(cn.value).match(/(\d{14})/);
      if (m) cnpj = m[1];
    }
  }
  return { certPem, keyPem, cnpj };
}

// ── XML distDFeInt ───────────────────────────────────────────────

function montarDistDFeInt(opts: {
  ambiente: "1" | "2";
  cnpj: string;
  ultNSU: string;
  cUFAutor?: string; // 91 = AN
}): string {
  const cUF = opts.cUFAutor ?? "91";
  const ultNSU = String(opts.ultNSU).padStart(15, "0");
  return `<?xml version="1.0" encoding="UTF-8"?>
<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
  <tpAmb>${opts.ambiente}</tpAmb>
  <cUFAutor>${cUF}</cUFAutor>
  <CNPJ>${opts.cnpj}</CNPJ>
  <distNSU>
    <ultNSU>${ultNSU}</ultNSU>
  </distNSU>
</distDFeInt>`;
}

function envelopeSoap(distDFeInt: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Header/>
  <soap:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>${distDFeInt}</nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap:Body>
</soap:Envelope>`;
}

function endpointAN(amb: "1" | "2"): string {
  return amb === "1"
    ? "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx"
    : "https://hom.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx";
}

// ── Parsing do retorno ───────────────────────────────────────────

interface DocResumo {
  nsu: string;
  schema: string;
  /** XML decodificado (procNFe/resNFe/procEventoNFe...). */
  xml: string;
  /** Chave de acesso, quando extraível. */
  chave?: string;
  /** Quando for resumo (resNFe), traz dados básicos. */
  resumo?: {
    cnpjEmitente?: string;
    nomeEmitente?: string;
    valorTotal?: number;
    dataEmissao?: string;
    numero?: string;
    serie?: string;
    situacao?: string;
  };
}

function extrairTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1] : null;
}

function parseRetDistDFeInt(xmlSoap: string): {
  cStat: string;
  xMotivo: string;
  ultNSU: string;
  maxNSU: string;
  docs: DocResumo[];
} {
  // Extrai bloco retDistDFeInt
  const ret = extrairTag(xmlSoap, "retDistDFeInt") ?? xmlSoap;
  const cStat = extrairTag(ret, "cStat") ?? "";
  const xMotivo = extrairTag(ret, "xMotivo") ?? "";
  const ultNSU = extrairTag(ret, "ultNSU") ?? "0";
  const maxNSU = extrairTag(ret, "maxNSU") ?? ultNSU;

  const docs: DocResumo[] = [];
  // <docZip NSU="..." schema="..."><base64 gzip></docZip>
  const re = /<docZip\s+([^>]+)>([\s\S]*?)<\/docZip>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(ret)) !== null) {
    const attrs = m[1];
    const b64 = m[2].trim();
    const nsuMatch = attrs.match(/NSU="(\d+)"/);
    const schemaMatch = attrs.match(/schema="([^"]+)"/);
    const nsu = nsuMatch ? nsuMatch[1] : "";
    const schema = schemaMatch ? schemaMatch[1] : "";
    let xml = "";
    try {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const out = gunzipSync(bin);
      xml = new TextDecoder("utf-8").decode(out);
    } catch (e) {
      console.error("Falha gunzip docZip NSU=", nsu, e);
      continue;
    }

    // Extração leve para resumo / chave
    const chave = (xml.match(/Id="NFe(\d{44})"/) || xml.match(/<chNFe>(\d{44})<\/chNFe>/))
      ?.[1];
    const resumo: DocResumo["resumo"] = {
      cnpjEmitente: extrairTag(xml, "CNPJ") ?? undefined,
      nomeEmitente: extrairTag(xml, "xNome") ?? undefined,
      valorTotal: (() => {
        const v = extrairTag(xml, "vNF");
        return v ? Number(v) : undefined;
      })(),
      dataEmissao: extrairTag(xml, "dhEmi") ?? undefined,
      numero: extrairTag(xml, "nNF") ?? undefined,
      serie: extrairTag(xml, "serie") ?? undefined,
      situacao: extrairTag(xml, "cSitNFe") ?? undefined,
    };

    docs.push({ nsu, schema, xml, chave, resumo });
  }

  return { cStat, xMotivo, ultNSU, maxNSU, docs };
}

// ── Handler ──────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const log = createLogger("sefaz-distdfe", req);
  try {
    await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const action: string = body.action ?? "consultar-nsu";
    log.info("request", { action, ambiente: body.ambiente, ultNSU: body.ultNSU });

    if (action !== "consultar-nsu") {
      return json({ error: `action '${action}' inválida. Use 'consultar-nsu'.` }, 400);
    }

    const ambiente: "1" | "2" = body.ambiente === "1" ? "1" : "2";
    const ultNSUInput: string = String(body.ultNSU ?? "0").replace(/\D/g, "");

    // Senha do certificado
    const senha = Deno.env.get("CERTIFICADO_PFX_SENHA");
    if (!senha) {
      return json(
        { sucesso: false, erro: "Secret CERTIFICADO_PFX_SENHA não configurado." },
        500,
      );
    }

    // Baixa o PFX
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: blob, error: dlErr } = await adminClient.storage
      .from("dbavizee")
      .download("certificados/empresa.pfx");
    if (dlErr || !blob) {
      return json(
        {
          sucesso: false,
          erro: `Não foi possível ler o certificado do Storage: ${dlErr?.message ?? "arquivo ausente"}`,
        },
        500,
      );
    }
    const arr = new Uint8Array(await blob.arrayBuffer());
    const certBase64 = forge.util.encode64(String.fromCharCode(...arr));

    let certPem: string;
    let keyPem: string;
    let cnpj: string;
    try {
      const r = pfxToPem(certBase64, senha);
      certPem = r.certPem;
      keyPem = r.keyPem;
      cnpj = r.cnpj;
    } catch (e: any) {
      return json(
        { sucesso: false, erro: `Falha ao ler PFX: ${e.message}` },
        500,
      );
    }

    if (!cnpj || cnpj.length !== 14) {
      return json({ sucesso: false, erro: "CNPJ inválido extraído do certificado." }, 500);
    }

    // Cliente HTTP com mTLS
    let client: Deno.HttpClient;
    try {
      // @ts-ignore — Deno.createHttpClient é estável em Deno Deploy
      client = Deno.createHttpClient({ cert: certPem, key: keyPem });
    } catch (e: any) {
      return json(
        { sucesso: false, erro: `Falha ao criar cliente mTLS: ${e.message}` },
        500,
      );
    }

    const distDFeInt = montarDistDFeInt({ ambiente, cnpj, ultNSU: ultNSUInput });
    const envelope = envelopeSoap(distDFeInt);
    const url = endpointAN(ambiente);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    let xmlRetorno = "";
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/soap+xml; charset=utf-8",
          SOAPAction: "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse",
        },
        body: envelope,
        // @ts-ignore — option client é específica do Deno
        client,
        signal: controller.signal,
      });
      clearTimeout(timer);
      xmlRetorno = await resp.text();
      if (!resp.ok) {
        return json({
          sucesso: false,
          erro: `HTTP ${resp.status}: ${resp.statusText}`,
          xmlRetorno,
        });
      }
    } catch (e: any) {
      clearTimeout(timer);
      const msg = e?.name === "AbortError"
        ? "Timeout de 45s ao conectar com o Ambiente Nacional"
        : e?.message ?? String(e);
      return json({ sucesso: false, erro: msg });
    } finally {
      try {
        // @ts-ignore
        client.close?.();
      } catch (_) { /* ignore */ }
    }

    const parsed = parseRetDistDFeInt(xmlRetorno);
    log.info("retDistDFeInt", {
      cStat: parsed.cStat,
      xMotivo: parsed.xMotivo,
      docs: parsed.docs.length,
      ultNSU: parsed.ultNSU,
      maxNSU: parsed.maxNSU,
    });

    return json({
      sucesso: true,
      cnpj,
      ambiente,
      cStat: parsed.cStat,
      xMotivo: parsed.xMotivo,
      ultNSU: parsed.ultNSU,
      maxNSU: parsed.maxNSU,
      docs: parsed.docs,
    });
  } catch (err: any) {
    log.error("request failed", err);
    return json({ error: err.message || "Erro interno" }, err.message?.includes("Sessão") ? 401 : 500);
  }
});