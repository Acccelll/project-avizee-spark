import { buildCorsHeaders } from "../_shared/cors.ts";
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
import { requireAnyPermission, type PermissionRequirement } from "../_shared/permissions.ts";

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN");
let corsHeaders: Record<string, string> = buildCorsHeaders(null);
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getVaultSecretByName(
  adminClient: ReturnType<typeof createClient>,
  secretName: string,
): Promise<string | null> {
  const { data, error } = await adminClient.rpc("get_secret_vault_by_name", {
    p_name: secretName,
  });

  if (error) {
    throw new Error(`Falha ao ler segredo '${secretName}' no cofre: ${error.message}`);
  }

  const secret = typeof data === "string" ? data : data == null ? null : String(data);
  return secret && secret.length > 0 ? secret : null;
}

// ── UF → código IBGE (cUFAutor) ──────────────────────────────────
// NT 2014.002 v1.30: cUFAutor é o código IBGE da UF do interessado
// (ex.: 35=SP, 29=BA). Fallback "91" só quando UF não estiver configurada.
const UF_PARA_IBGE: Record<string, string> = {
  AC: "12", AL: "27", AP: "16", AM: "13", BA: "29", CE: "23", DF: "53",
  ES: "32", GO: "52", MA: "21", MT: "51", MS: "50", MG: "31", PA: "15",
  PB: "25", PR: "41", PE: "26", PI: "22", RJ: "33", RN: "24", RS: "43",
  RO: "11", RR: "14", SC: "42", SP: "35", SE: "28", TO: "17",
};

// ── Catálogo oficial cStat (NT 2014.002 v1.30, seção 4) ─────────
const CSTAT_DESC: Record<string, string> = {
  "108": "Serviço paralisado momentaneamente.",
  "109": "Serviço paralisado sem previsão.",
  "137": "Nenhum documento localizado para o CNPJ do certificado.",
  "138": "Documento localizado.",
  "214": "Tamanho da mensagem excedeu o limite de 10 KB.",
  "215": "Falha no schema XML.",
  "217": "NF-e inexistente para a chave de acesso informada.",
  "236": "Chave de acesso com dígito verificador inválido.",
  "238": "Versão do XML superior à versão vigente.",
  "239": "Versão do XML não suportada.",
  "252": "Ambiente informado diverge do ambiente do Web Service.",
  "280": "Certificado de transmissor inválido.",
  "281": "Certificado de transmissor com data de validade vencida.",
  "283": "Cadeia do certificado de transmissor com erro.",
  "284": "Certificado de transmissor revogado.",
  "285": "Certificado de transmissor difere de ICP-Brasil.",
  "286": "Erro de acesso à LCR do certificado de transmissor.",
  "402": "XML com codificação diferente de UTF-8.",
  "404": "Uso de prefixo de namespace não permitido.",
  "472": "CPF consultado difere do CPF do certificado digital.",
  "473": "Certificado de transmissor sem CNPJ ou CPF.",
  "489": "CNPJ informado inválido.",
  "490": "CPF informado inválido.",
  "589": "NSU informado superior ao maior NSU do Ambiente Nacional.",
  "593": "CNPJ-base consultado difere do CNPJ-base do certificado — o A1 não pertence à empresa configurada.",
  "614": "Chave de acesso inválida (UF inválida).",
  "615": "Chave de acesso inválida (ano).",
  "616": "Chave de acesso inválida (mês).",
  "617": "Chave de acesso inválida (CNPJ).",
  "618": "Chave de acesso inválida (modelo diferente de 55).",
  "619": "Chave de acesso inválida (número da NF = 0).",
  "632": "Solicitação fora do prazo: NF-e tem mais de 90 dias e não está mais disponível.",
  "640": "CNPJ/CPF do interessado não tem permissão para consultar esta NF-e — peça o XML diretamente ao emissor.",
  "641": "NF-e indisponível para o emitente (use 'Consultar SEFAZ' na lista, não esta busca).",
  "653": "NF-e cancelada — arquivo indisponível para download.",
  "654": "NF-e denegada — arquivo indisponível para download.",
  "656": "Consumo indevido: o CNPJ foi bloqueado por 1 hora por excesso de consultas. Aguarde antes de tentar novamente.",
  "999": "Erro não catalogado pelo Ambiente Nacional.",
};

async function requireAuth(req: Request) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Token de autenticação ausente.");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  // Chamadas internas (process-distdfe-cron) usam SERVICE_ROLE_KEY como
  // Authorization. Reconhecemos esse caso e tratamos como "sistema".
  if (token === serviceRoleKey) {
    return { id: "__service_role__", isService: true } as const;
  }
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error("Sessão inválida ou expirada.");
  return { id: data.user.id, isService: false as const };
}

// ── PFX → PEM (cert + chave privada) ─────────────────────────────
// Movido para `_shared/pfx.ts` para reuso entre edge functions.
import { pfxToPem } from "../_shared/pfx.ts";

// ── XML distDFeInt ───────────────────────────────────────────────

function montarDistDFeInt(opts: {
  ambiente: "1" | "2";
  cnpj: string;
  ultNSU?: string;
  chNFe?: string;
  cUFAutor?: string; // 91 = AN
}): string {
  const cUF = opts.cUFAutor ?? "91";
  const corpo = opts.chNFe
    ? `<consChNFe><chNFe>${opts.chNFe}</chNFe></consChNFe>`
    : `<distNSU><ultNSU>${String(opts.ultNSU ?? "0").padStart(15, "0")}</ultNSU></distNSU>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
  <tpAmb>${opts.ambiente}</tpAmb>
  <cUFAutor>${cUF}</cUFAutor>
  <CNPJ>${opts.cnpj}</CNPJ>
  ${corpo}
</distDFeInt>`;
}

/**
 * Monta o XML consNFeDest para busca de NF-e por destinatário (NT 2014.002).
 * Endpoint: NFeConsultaDest.asmx — permite recuperação retroativa sem
 * depender do cursor NSU do DistDFe.
 */
function montarConsNFeDest(opts: {
  ambiente: "1" | "2";
  cnpj: string;
  indNFe?: string; // "0" = todas, "1" = somente não consultadas
  indEmi?: string; // "0" = todos, "1" = avulsa, "2" = normal, "3" = contingência
  ultNSU?: string; // paginação; "0" = primeiro lote
}): string {
  const indNFe = opts.indNFe ?? "0";
  const indEmi = opts.indEmi ?? "0";
  const ultNSU = String(opts.ultNSU ?? "0").padStart(15, "0");
  return (
    `<consNFeDest versao="1.01" xmlns="http://www.portalfiscal.inf.br/nfe">` +
    `<tpAmb>${opts.ambiente}</tpAmb>` +
    `<xServ>CONSULTAR NFE DESTINATARIO</xServ>` +
    `<CNPJ>${opts.cnpj}</CNPJ>` +
    `<indNFe>${indNFe}</indNFe>` +
    `<indEmi>${indEmi}</indEmi>` +
    `<ultNSU>${ultNSU}</ultNSU>` +
    `</consNFeDest>`
  );
}

function endpointNFeDest(amb: "1" | "2"): string {
  return amb === "1"
    ? "https://www.nfe.fazenda.gov.br/NFeConsultaDest/NFeConsultaDest.asmx"
    : "https://hom.nfe.fazenda.gov.br/NFeConsultaDest/NFeConsultaDest.asmx";
}

function envelopeSoapDest(corpo: string, variant: SoapVariant): string {
  if (variant === "soap12") {
    return (
      `<?xml version="1.0" encoding="utf-8"?>` +
      `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" ` +
      `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
      `xmlns:xsd="http://www.w3.org/2001/XMLSchema">` +
      `<soap12:Header>` +
      `<nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaDest">` +
      `<cUF>91</cUF><versaoDados>1.01</versaoDados>` +
      `</nfeCabecMsg>` +
      `</soap12:Header>` +
      `<soap12:Body>` +
      `<nfeConsultaNFDestinatarioNF xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaDest">` +
      `<nfeDadosMsg>${corpo}</nfeDadosMsg>` +
      `</nfeConsultaNFDestinatarioNF>` +
      `</soap12:Body>` +
      `</soap12:Envelope>`
    );
  }
  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" ` +
    `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
    `xmlns:xsd="http://www.w3.org/2001/XMLSchema">` +
    `<soap:Header>` +
    `<nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaDest">` +
    `<cUF>91</cUF><versaoDados>1.01</versaoDados>` +
    `</nfeCabecMsg>` +
    `</soap:Header>` +
    `<soap:Body>` +
    `<nfeConsultaNFDestinatarioNF xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaDest">` +
    `<nfeDadosMsg>${corpo}</nfeDadosMsg>` +
    `</nfeConsultaNFDestinatarioNF>` +
    `</soap:Body>` +
    `</soap:Envelope>`
  );
}

/** Parser do retConsNFeDest — extrai chaves e NSU de cada resNFe retornado. */
function parseRetConsNFeDest(xml: string): {
  cStat: string;
  xMotivo: string;
  ultNSU: string;
  maxNSU: string;
  chaves: Array<{ chave: string; nsu: string; dhRecbto?: string }>;
} {
  const cStat = xml.match(/<cStat>(\d+)<\/cStat>/)?.[1] ?? "";
  const xMotivo = xml.match(/<xMotivo>([^<]*)<\/xMotivo>/)?.[1] ?? "";
  const ultNSU = xml.match(/<ultNSU>(\d+)<\/ultNSU>/)?.[1] ?? "0";
  const maxNSU = xml.match(/<maxNSU>(\d+)<\/maxNSU>/)?.[1] ?? "0";
  const chaves: Array<{ chave: string; nsu: string; dhRecbto?: string }> = [];
  const regex = /<resNFe[^>]*>([\s\S]*?)<\/resNFe>/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(xml)) !== null) {
    const bloco = m[1];
    const chave = bloco.match(/<chNFe>(\d{44})<\/chNFe>/)?.[1];
    const nsu = bloco.match(/<NSU>(\d+)<\/NSU>/)?.[1] ?? "0";
    const dhRecbto = bloco.match(/<dhRecbto>([^<]*)<\/dhRecbto>/)?.[1];
    if (chave) chaves.push({ chave, nsu, dhRecbto });
  }
  return { cStat, xMotivo, ultNSU, maxNSU, chaves };
}

/**
 * Monta o envelope SOAP do NFeDistribuicaoDFe.
 *
 * O WSDL desse serviço expõe DOIS bindings:
 *  - SOAP 1.1 (`http://schemas.xmlsoap.org/soap/envelope/`) com header HTTP `SOAPAction`.
 *  - SOAP 1.2 (`http://www.w3.org/2003/05/soap-envelope`) com `action` embutida no `Content-Type`.
 *
 * O IIS do Ambiente Nacional aceita os dois, mas a combinação que historicamente
 * funciona sem `Connection reset by peer` é SOAP 1.2 com `application/soap+xml`.
 * Por isso essa função é parametrizada por `variant` e a edge tenta SOAP 1.2
 * primeiro e cai para SOAP 1.1 como fallback.
 *
 * O serviço NÃO declara `nfeCabecMsg` — apenas `nfeDadosMsg` dentro de
 * `nfeDistDFeInteresse`.
 */
type SoapVariant = "soap12" | "soap11";

function envelopeSoap(distDFeInt: string, variant: SoapVariant): string {
  const inner = distDFeInt.replace(/<\?xml[^?]*\?>\s*/g, "").trim();
  // ATENÇÃO — NÃO REINTRODUZIR <nfeCabecMsg>.
  // O WSDL do NFeDistribuicaoDFe (AN) NÃO declara `nfeCabecMsg` — apenas
  // `nfeDadosMsg` dentro de `nfeDistDFeInteresse`. Diferente dos serviços
  // de Autorização/Consulta protocolo, enviar o header faz o IIS do AN
  // derrubar a conexão TCP antes de gerar SOAP Fault — causa raiz dos
  // "Connection reset by peer" observados em prod (abr–mai/2026).
  // `cUFAutor` (UF do interessado) vai apenas no corpo `distDFeInt`,
  // nunca no envelope. Ver `mem/features/fiscal-consulta-por-chave.md`.
  if (variant === "soap12") {
    return `<?xml version="1.0" encoding="UTF-8"?>` +
      `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" ` +
      `xmlns:xsd="http://www.w3.org/2001/XMLSchema" ` +
      `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
      `<soap12:Body>` +
      `<nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">` +
      `<nfeDadosMsg>${inner}</nfeDadosMsg>` +
      `</nfeDistDFeInteresse>` +
      `</soap12:Body>` +
      `</soap12:Envelope>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" ` +
    `xmlns:xsd="http://www.w3.org/2001/XMLSchema" ` +
    `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<soap:Body>` +
    `<nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">` +
    `<nfeDadosMsg>${inner}</nfeDadosMsg>` +
    `</nfeDistDFeInteresse>` +
    `</soap:Body>` +
    `</soap:Envelope>`;
}

const SOAP_ACTION_DISTDFE =
  "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse";

function headersFor(variant: SoapVariant): Record<string, string> {
  if (variant === "soap12") {
    return {
      // SOAP 1.2: action obrigatoriamente embutida no Content-Type;
      // SOAPAction como header HTTP é IGNORADO pelo binding 1.2.
      "Content-Type":
        `application/soap+xml; charset=utf-8; action="${SOAP_ACTION_DISTDFE}"`,
      Accept: "application/soap+xml, text/xml, multipart/related",
      "User-Agent": "AviZee-ERP/1.0 (+sefaz-distdfe)",
    };
  }
  return {
    "Content-Type": "text/xml; charset=utf-8",
    SOAPAction: `"${SOAP_ACTION_DISTDFE}"`,
    Accept: "text/xml, application/soap+xml; charset=utf-8",
    "User-Agent": "AviZee-ERP/1.0 (+sefaz-distdfe)",
  };
}

function endpointAN(amb: "1" | "2"): string {
  return amb === "1"
    ? "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx"
    // URL oficial do AN para homologação (Portal Nacional NF-e). O host
    // correto é `hom1.nfe.fazenda.gov.br` — o `hom.nfe.fazenda.gov.br` é
    // do RecepcaoEvento AN e fechava a conexão para DistDFe.
    : "https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx";
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
  corsHeaders = buildCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const log = createLogger("sefaz-distdfe", req);
  try {
    const user = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const action: string = body.action ?? "consultar-nsu";
    log.info("request", { action, ambiente: body.ambiente, ultNSU: body.ultNSU, chNFe: body.chNFe });

    if (action === "status") {
      const flag = (Deno.env.get("SEFAZ_USE_MTLS_PROXY") ?? "").trim().toLowerCase();
      const pUrl = Deno.env.get("SEFAZ_MTLS_PROXY_URL")?.trim() || "";
      const pSecret = Deno.env.get("SEFAZ_MTLS_PROXY_SECRET")?.trim() || "";
      const ativo = ["true", "1", "yes", "sim"].includes(flag) && !!pUrl && !!pSecret;
      return json({
        sucesso: true,
        proxyEnabled: ativo,
        hasProxyUrl: !!pUrl,
        hasProxySecret: !!pSecret,
        flagAtiva: ["true", "1", "yes", "sim"].includes(flag),
        flagLen: flag.length,
        transporte: ativo ? "cloudflare-worker" : "deno-mtls-direto",
        observacao: ativo
          ? "Worker mTLS ativo — transporte obrigatório (Deno/rustls não suporta renegociação TLS do IIS da SEFAZ)."
          : "Worker mTLS inativo. ATENÇÃO: o transporte direto deno-mtls não funciona contra o AN (renegociação TLS).",
      }, 200);
    }

    if (action === "worker-ping") {
      const ambientePing: "1" | "2" = body.ambiente === "1" ? "1" : "2";
      const pUrl = Deno.env.get("SEFAZ_MTLS_PROXY_URL")?.trim() || "";
      const pSecret = Deno.env.get("SEFAZ_MTLS_PROXY_SECRET")?.trim() || "";
      if (!pUrl || !pSecret) {
        return json({
          sucesso: false,
          ambiente: ambientePing,
          diagnostico: "SEFAZ_MTLS_PROXY_URL/SECRET ausentes — Worker não configurado.",
          erro: "worker-nao-configurado",
        }, 200);
      }
      const alvo = endpointAN(ambientePing);
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 20_000);
        // Diagnóstico opcional: permite reproduzir a chamada real
        // (envelope SOAP + Content-Type com action) para isolar o 520.
        const corpoPing: string = typeof body.corpo === "string" ? body.corpo : "";
        const ctPing: string = typeof body.contentType === "string"
          ? body.contentType
          : "application/soap+xml; charset=utf-8";
        const extraHeaders: Record<string, string> = {};
        if (typeof body.soapaction === "string") extraHeaders["soapaction"] = body.soapaction;
        const r = await fetch(pUrl, {
          method: "POST",
          headers: {
            "x-proxy-secret": pSecret,
            "x-target-url": alvo,
            "Content-Type": ctPing,
            ...extraHeaders,
          },
          body: corpoPing,
          signal: ctrl.signal,
        });
        clearTimeout(t);
        const txt = await r.text();
        return json({
          sucesso: r.status !== 520 && r.status !== 401,
          ambiente: ambientePing,
          alvo,
          statusHttp: r.status,
          preview: txt.slice(0, 300),
          diagnostico: r.status === 520
            ? "Worker respondeu 520 — o binding mTLS provavelmente não cobre este hostname."
            : r.status === 401
            ? "Worker rejeitou o secret (401) — confira SEFAZ_MTLS_PROXY_SECRET."
            : "Transporte Worker→SEFAZ alcançou o servidor (qualquer status HTTP da SEFAZ é prova de conectividade).",
        }, 200);
      } catch (e: any) {
        return json({
          sucesso: false,
          ambiente: ambientePing,
          alvo,
          diagnostico: `Falha ao chamar o Worker: ${e?.message ?? String(e)}`,
          erro: "worker-unreachable",
        }, 200);
      }
    }

    if (action !== "consultar-nsu" && action !== "consultar-chave" && action !== "consultar-destinatario") {
      return json({ error: `action '${action}' inválida. Use 'consultar-nsu', 'consultar-chave', 'consultar-destinatario', 'status' ou 'worker-ping'.` }, 400);
    }

    // Autorização granular: ambas as actions exigem ao menos `visualizar`
    // do módulo fiscal (admin global ignora). Bloqueia qualquer usuário
    // logado sem vínculo com o módulo fiscal de disparar consultas SEFAZ.
    const allowed: PermissionRequirement[] = [
      { resource: "faturamento_fiscal", action: "visualizar" },
      { resource: "faturamento_fiscal", action: "criar" },
      { resource: "faturamento_fiscal", action: "importar_xml" },
      { resource: "faturamento_fiscal", action: "admin_fiscal" },
    ];
    try {
      if (!user.isService) {
      await requireAnyPermission(user.id, allowed);
      }
    } catch (permErr: any) {
      const status = permErr?.status === 403 ? 403 : 500;
      log.warn("permission denied", { action, userId: user.id, message: permErr?.message });
      return json({ sucesso: false, erro: permErr.message ?? "Permissão negada" }, status);
    }

    // Default = produção ("1"). Homologação só quando explicitamente "2".
    const ambiente: "1" | "2" = body.ambiente === "2" ? "2" : "1";
    const ultNSUInput: string = String(body.ultNSU ?? "0").replace(/\D/g, "");
    const chNFeInput: string = String(body.chNFe ?? "").replace(/\D/g, "");
    if (action === "consultar-chave" && chNFeInput.length !== 44) {
      return json({ sucesso: false, erro: "Chave de acesso (chNFe) inválida — exige 44 dígitos." }, 400);
    }

    // Baixa o PFX + lê a senha persistida no cofre seguro.
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const senha = await getVaultSecretByName(adminClient, "CERTIFICADO_PFX_SENHA");
    if (!senha) {
      return json(
        {
          sucesso: false,
          erro: "Senha do certificado não encontrada no cofre seguro. Reenvie o certificado em Configuração Fiscal.",
        },
        500,
      );
    }

    // Lê UF da empresa para compor cUFAutor conforme NT 2014.002 v1.30.
    let cUFAutor = "91";
    try {
      const { data: cfg } = await adminClient
        .from("empresa_config")
        .select("uf")
        .limit(1)
        .maybeSingle();
      const uf = String((cfg as any)?.uf ?? "").trim().toUpperCase();
      if (uf && UF_PARA_IBGE[uf]) cUFAutor = UF_PARA_IBGE[uf];
      else log.info("cUFAutor fallback 91", { uf_lida: uf });
    } catch (e) {
      log.info("cUFAutor fallback 91 (erro lendo empresa_config)", { e: String(e) });
    }

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

    // Throttle server-side (item 2.5 do plano Onda 8): cron com SR é bypass.
    // Janela padrão 1h, máximo 18 chamadas por (cnpj, action).
    if (!user.isService) {
      try {
        const { data: pode, error: throttleErr } = await adminClient.rpc(
          "sefaz_consulta_pode_disparar",
          { p_cnpj: cnpj, p_action: action },
        );
        if (throttleErr) {
          log.warn("throttle rpc error (fail-open)", { message: throttleErr.message });
        } else if (pode === false) {
          log.warn("throttle bloqueou", { cnpj, action });
          return json(
            {
              sucesso: false,
              erro: "Limite de consultas SEFAZ excedido nesta janela. Aguarde alguns minutos e tente novamente.",
              codigoTransporte: "RATE_LIMITED",
              janelaSeg: 3600,
              max: 18,
            },
            429,
          );
        }
      } catch (e: any) {
        log.warn("throttle check exception (fail-open)", { message: e?.message });
      }
    }

    // Transporte mTLS: Worker Cloudflare REATIVADO (jun/2026).
    // O Deno/rustls NÃO suporta a renegociação TLS exigida pelo IIS da SEFAZ
    // (denoland/deno#32245) — o transporte direto deno-mtls nunca conecta no AN.
    // O Worker (binding mtls_certificate cobrindo www1 e hom1) é obrigatório.
    const flagProxy = (Deno.env.get("SEFAZ_USE_MTLS_PROXY") ?? "").trim().toLowerCase();
    const proxyUrl: string | undefined = Deno.env.get("SEFAZ_MTLS_PROXY_URL")?.trim() || undefined;
    const proxySecret: string | undefined = Deno.env.get("SEFAZ_MTLS_PROXY_SECRET")?.trim() || undefined;
    const usarProxy = ["true", "1", "yes", "sim"].includes(flagProxy) && !!proxyUrl && !!proxySecret;
    log.info("transporte resolvido", {
      usarProxy,
      transporte: usarProxy ? "cloudflare-worker" : "deno-mtls",
      flagAtiva: ["true", "1", "yes", "sim"].includes(flagProxy),
      hasProxyUrl: !!proxyUrl,
      hasProxySecret: !!proxySecret,
    });

    let client: Deno.HttpClient | null = null;
    if (!usarProxy) {
      try {
        // @ts-ignore — Deno.createHttpClient é estável em Deno Deploy
        client = Deno.createHttpClient({
          cert: certPem,
          key: keyPem,
          http1: true,
          http2: false,
        });
      } catch (e: any) {
        return json(
          { sucesso: false, erro: `Falha ao criar cliente mTLS: ${e.message}` },
          500,
        );
      }
    }

    // Ação consultar-destinatario REMOVIDA (jun/2026):
    // NFeConsultaDest foi descontinuado pela SEFAZ em 2017 e responde SOAP vazio.
    // Use action="consultar-nsu" (DistDFe) ou action="consultar-chave" (consChNFe).
    if (action === "consultar-destinatario") {
      try { /* @ts-ignore */ client?.close?.(); } catch (_) { /* ignore */ }
      return json({
        sucesso: false,
        erro: "Ação descontinuada: NFeConsultaDest foi removido pela SEFAZ. Use consultar-nsu ou consultar-chave.",
      }, 400);
    }

    const distDFeInt = action === "consultar-chave"
      ? montarDistDFeInt({ ambiente, cnpj, chNFe: chNFeInput, cUFAutor })
      : montarDistDFeInt({ ambiente, cnpj, ultNSU: ultNSUInput, cUFAutor });
    const url = endpointAN(ambiente);

    // Tentamos SOAP 1.2 primeiro (binding oficial estável do .asmx do AN).
    // Se houver erro de transporte (reset/timeout/TLS) sem nenhuma resposta
    // HTTP, fazemos UMA tentativa adicional em SOAP 1.1. Qualquer resposta
    // HTTP da SEFAZ (mesmo 500/SOAP Fault) interrompe o fallback porque já
    // representa diagnóstico oficial.
    // O Worker→SEFAZ é intermitente (520/500-vazio esporádicos do BIG-IP do AN);
    // o mesmo envelope passa segundos depois. Por isso fazemos até 4 tentativas
    // alternando variantes, com backoff curto entre elas.
    const tentativas: SoapVariant[] = ["soap12", "soap11", "soap12", "soap11"];
    let xmlRetorno = "";
    let respondeu = false;
    let ultimoErroTransporte: { raw: string; codigo: string } | null = null;

    for (let i = 0; i < tentativas.length; i++) {
      const variant = tentativas[i];
      const envelope = envelopeSoap(distDFeInt, variant);
      const headersSoap = headersFor(variant);

      log.info("preparado envio SEFAZ", {
        url,
        transporte: usarProxy ? "cloudflare-worker" : "deno-mtls",
        soapVariant: variant,
        tentativa: i + 1,
        ambiente,
        action,
        cUFAutor,
        cnpjLen: cnpj.length,
        envelopeBytes: envelope.length,
        certChainBytes: certPem.length,
      });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45_000);
      try {
        const resp = usarProxy
          ? await fetch(proxyUrl!, {
              method: "POST",
              headers: {
                "x-proxy-secret": proxySecret!,
                "x-target-url": url,
                "Content-Type": headersSoap["Content-Type"] ??
                  headersSoap["content-type"] ?? "application/soap+xml; charset=utf-8",
                ...(headersSoap["SOAPAction"]
                  ? { soapaction: headersSoap["SOAPAction"] }
                  : {}),
              },
              body: envelope,
              signal: controller.signal,
            })
          : await fetch(url, {
              method: "POST",
              headers: headersSoap,
              body: envelope,
              // @ts-ignore — option client é específica do Deno
              client: client!,
              signal: controller.signal,
            });
        clearTimeout(timer);
        const respText = await resp.text();

        if (usarProxy) {
          // Novo contrato: Worker repassa a resposta da SEFAZ tal-qual
          // (status + body cru). Status 401/400 do próprio Worker indicam
          // erro de configuração; demais status são da SEFAZ.
          xmlRetorno = respText;
          log.info("resposta SEFAZ via worker", {
            statusHttp: resp.status,
            statusText: resp.statusText,
            soapVariant: variant,
            bytes: xmlRetorno.length,
            preview: xmlRetorno.slice(0, 240),
          });
          // Worker devolve HTTP 200 com JSON {"success":false,"status":<upstream>,...}
          // quando o fetch dele contra a SEFAZ falha (ex.: binding mTLS não cobre o
          // hostname de produção). Sem este guard, o JSON era parseado como XML e a
          // sync terminava "ok" com cStat vazio e 0 docs — falha silenciosa.
          let workerFail: { status: number; body: string } | null = null;
          if (xmlRetorno.trimStart().startsWith("{")) {
            try {
              const wj = JSON.parse(xmlRetorno);
              if (wj && wj.success === false) {
                workerFail = {
                  status: Number(wj.status) || 0,
                  body: String(wj.body ?? "").slice(0, 240),
                };
              } else if (wj && wj.success === true && typeof wj.body === "string") {
                // Worker devolve sucesso como JSON {"success":true,"status":200,"body":"<xml>"}.
                // Desembrulha o XML da SEFAZ para o parser downstream.
                xmlRetorno = wj.body;
                log.info("worker unwrap ok", {
                  upstreamStatus: Number(wj.status) || 0,
                  bytes: xmlRetorno.length,
                });
              }
            } catch (_) { /* não é o envelope JSON do Worker */ }
          }
          if (workerFail) {
            log.info("worker reportou falha upstream", {
              soapVariant: variant,
              tentativa: i + 1,
              upstreamStatus: workerFail.status,
              upstreamBody: workerFail.body,
            });
            // Detecta a página de erro padrão do CLOUDFLARE (não do BIG-IP da SEFAZ):
            // `Content-Type: text/plain`, `Content-Length: 15`, body literal
            // "error code: 520". Indica que o fetch do Worker para a origem falhou
            // antes mesmo de chegar na SEFAZ — tipicamente binding `mtls_certificate`
            // ausente/desconfigurado ou certificado A1 expirado no Cloudflare.
            // Determinístico: retry não resolve, abortamos imediatamente.
            const isCloudflareOriginFail =
              workerFail.status === 520 &&
              /^error code:\s*520\s*$/i.test(workerFail.body.trim());
            if (isCloudflareOriginFail) {
              ultimoErroTransporte = {
                raw:
                  "Cloudflare Worker não conseguiu estabelecer conexão com a SEFAZ " +
                  "(retornou a página de erro 520 do próprio Cloudflare, não da SEFAZ).",
                codigo: "CLOUDFLARE_ORIGIN_FAIL",
              };
              break;
            }
            ultimoErroTransporte = {
              raw: `Worker→SEFAZ falhou (HTTP ${workerFail.status}): ${workerFail.body || "<sem corpo>"}`,
              codigo: workerFail.status === 520
                ? "WORKER_UPSTREAM_520"
                : workerFail.status >= 500
                ? "WORKER_UPSTREAM_5XX"
                : "WORKER_UPSTREAM_ERROR",
            };
            // 520/5xx intermitentes do BIG-IP do AN: aguarda um pouco e
            // tenta de novo (a mesma requisição costuma passar em seguida).
            if (i < tentativas.length - 1) {
              await new Promise((r) => setTimeout(r, 1500));
            }
            continue;
          }
          // 401/400 com corpo curto = erro do próprio Worker (não da SEFAZ).
          if ((resp.status === 401 || resp.status === 400) && xmlRetorno.length < 200) {
            try { /* @ts-ignore */ client?.close?.(); } catch (_) { /* ignore */ }
            return json({
              sucesso: false,
              erro: `Worker mTLS rejeitou requisição (HTTP ${resp.status}): ${xmlRetorno}`,
              xmlRetorno,
              codigoTransporte: "WORKER_ERROR",
            });
          }
          // 5xx do AN → trata como falha de transporte e tenta a próxima
          // variante (SOAP 1.1) antes de desistir.
          if (resp.status >= 500) {
            log.info("falha de transporte SEFAZ via worker", {
              soapVariant: variant,
              tentativa: i + 1,
              statusHttp: resp.status,
              preview: xmlRetorno.slice(0, 240),
            });
            ultimoErroTransporte = {
              raw: `SEFAZ HTTP ${resp.status}: ${xmlRetorno.slice(0, 240)}`,
              codigo: resp.status === 520 ? "CLOUDFLARE_520" : "SEFAZ_5XX",
            };
            continue;
          }
          if (!resp.ok) {
            try { /* @ts-ignore */ client?.close?.(); } catch (_) { /* ignore */ }
            return json({
              sucesso: false,
              erro: `SEFAZ HTTP ${resp.status}: ${resp.statusText}`,
              xmlRetorno,
            });
          }
          // Sucesso: marca para sair do loop
          respondeu = true;
          break;
        } else {
          xmlRetorno = respText;
          log.info("resposta SEFAZ recebida", {
            statusHttp: resp.status,
            statusText: resp.statusText,
            contentType: resp.headers.get("content-type"),
            soapVariant: variant,
            bytes: xmlRetorno.length,
            preview: xmlRetorno.slice(0, 240),
          });
          if (!resp.ok) {
            // 415/500 com corpo: SOAP Fault legítimo. Não tenta outra variante.
            try { /* @ts-ignore */ client?.close?.(); } catch (_) { /* ignore */ }
            return json({
              sucesso: false,
              erro: `HTTP ${resp.status}: ${resp.statusText}`,
              xmlRetorno,
              soapVariant: variant,
            });
          }
        }
        respondeu = true;
        break;
      } catch (e: any) {
        clearTimeout(timer);
        const raw = e?.name === "AbortError"
          ? "Timeout de 45s ao conectar com o Ambiente Nacional"
          : e?.message ?? String(e);
        const looksLikeHttp2 = /HTTP\/1\.1|http2 error|stream error/i.test(raw);
        const looksLikeUnknownIssuer = /UnknownIssuer|invalid peer certificate/i.test(raw);
        const looksLikeReset = /Connection reset|reset by peer|EOF/i.test(raw);
        const looksLikeTls = /tls|handshake|alert/i.test(raw);
        const codigo = looksLikeUnknownIssuer
          ? "UNKNOWN_ISSUER"
          : looksLikeHttp2
          ? "HTTP2_REQUIRED"
          : looksLikeReset
          ? "CONNECTION_RESET"
          : looksLikeTls
          ? "TLS_FAILURE"
          : "TRANSPORT_ERROR";
        log.info("falha de transporte SEFAZ", {
          soapVariant: variant,
          tentativa: i + 1,
          codigo,
          raw: raw.slice(0, 240),
        });
        ultimoErroTransporte = { raw, codigo };
        // Erros de cadeia ICP-Brasil/HTTP2 não se resolvem mudando a variante.
        if (looksLikeUnknownIssuer || looksLikeHttp2) break;
        // Demais: tenta a próxima variante.
        continue;
      }
    }

    if (!respondeu) {
      try { /* @ts-ignore */ client?.close?.(); } catch (_) { /* ignore */ }
      const codigo = ultimoErroTransporte?.codigo ?? "TRANSPORT_ERROR";
      const raw = ultimoErroTransporte?.raw ?? "Falha de transporte sem detalhes.";
      let hint = "";
      if (codigo === "HTTP2_REQUIRED") {
        hint = " — o webservice NFeDistribuicaoDFe exige HTTP/1.1; ajuste o cliente para forçar http1.";
      } else if (codigo === "UNKNOWN_ISSUER") {
        hint = " — a cadeia de certificados do servidor SEFAZ não foi reconhecida pelo runtime (cadeia ICP-Brasil ausente). Caso recorrente, embutir caCerts ICP-Brasil no cliente HTTP.";
      } else if (codigo === "CONNECTION_RESET" || codigo === "TLS_FAILURE") {
        hint =
          " — falha de transporte contra o Ambiente Nacional após tentar SOAP 1.2 e SOAP 1.1. Possíveis causas: cadeia ICP-Brasil incompleta no A1, certificado expirado/de outro ambiente, ou bloqueio temporário do CNPJ no AN. O Portal NF-e segue funcionando, então o serviço da Receita está no ar.";
      } else if (codigo === "WORKER_UPSTREAM_520") {
        hint =
          " — o Ambiente Nacional respondeu HTTP 520 nas 4 tentativas (instabilidade do BIG-IP da SEFAZ ou bloqueio temporário do CNPJ). Aguarde alguns minutos e sincronize de novo.";
      } else if (codigo === "CLOUDFLARE_ORIGIN_FAIL") {
        hint =
          " — o problema NÃO é a SEFAZ. O próprio Cloudflare devolveu a página \"error code: 520\" (origin unreachable), o que significa que o Worker mTLS não conseguiu abrir conexão TLS com a SEFAZ. Causas prováveis, em ordem: (1) certificado A1 instalado no Cloudflare expirou ou foi removido; (2) o binding `mtls_certificate` do Worker não está mais associado/ativo; (3) o binding não inclui o hostname alvo. Verifique no painel do Cloudflare → Worker → Settings → mTLS Certificates e refaça o upload do certificado A1 se necessário.";
      }
      return json({
        sucesso: false,
        ambiente,
        cnpj,
        erro: `${raw}${hint}`,
        codigoTransporte: codigo,
      });
    }

    try { /* @ts-ignore */ client?.close?.(); } catch (_) { /* ignore */ }

    // Telemetria de diagnóstico: preview do retDistDFeInt + NSUs dos docZips.
    // Permite distinguir entre cursor travado no AN vs parser pegando o ultNSU
    // errado quando há eco/aninhamento no envelope SOAP. Não loga conteúdo de
    // docs — só os atributos NSU (públicos no envelope).
    try {
      const retPreview = extrairTag(xmlRetorno, "retDistDFeInt") ?? xmlRetorno;
      log.info("retDistDFeInt preview", {
        preview: retPreview.slice(0, 1500),
        totalBytes: xmlRetorno.length,
      });
    } catch (_) { /* best-effort */ }

    const parsed = parseRetDistDFeInt(xmlRetorno);
    log.info("retDistDFeInt", {
      cStat: parsed.cStat,
      xMotivo: parsed.xMotivo,
      docs: parsed.docs.length,
      ultNSU: parsed.ultNSU,
      maxNSU: parsed.maxNSU,
    });
    log.info("docZips NSUs", { nsus: parsed.docs.map((d) => d.nsu) });

    return json({
      sucesso: true,
      cnpj,
      ambiente,
      cStat: parsed.cStat,
      xMotivo: parsed.xMotivo,
      mensagemCstat: CSTAT_DESC[parsed.cStat] ?? null,
      ultNSU: parsed.ultNSU,
      maxNSU: parsed.maxNSU,
      docs: parsed.docs,
    });
  } catch (err: any) {
    log.error("request failed", err);
    return json({ error: err.message || "Erro interno" }, err.message?.includes("Sessão") ? 401 : 500);
  }
});