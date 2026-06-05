import { buildCorsHeaders } from "../_shared/cors.ts";
// deno-lint-ignore-file no-explicit-any
/**
 * Edge Function: sefaz-proxy
 * Proxy para comunicação com a SEFAZ, incluindo assinatura digital XML (xmldsig)
 * e parsing de certificados A1 (PFX/P12).
 *
 * Actions:
 *   - parse-certificado: Extrai metadados (CNPJ, razão social, validade) do PFX
 *   - assinar-e-enviar-vault: Igual ao assinar-e-enviar, porém lê o .pfx do
 *     Storage privado `dbavizee/certificados/empresa.pfx` e a senha do secret
 *     `CERTIFICADO_PFX_SENHA`. O cliente NÃO envia senha nem certificado.
 *   - enviar-sem-assinatura-vault: Envia um SOAP arbitrário usando o A1 do
 *     Vault como mTLS, mas SEM aplicar XMLDSig. Usado para fluxos como
 *     NFeConsultaProtocolo4 (consSitNFe), que não exigem assinatura no XML.
 */

import forge from "https://esm.sh/node-forge@1.3.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createLogger } from "../_shared/logger.ts";
import { requireAnyPermission, hasAnyPermission, type PermissionRequirement } from "../_shared/permissions.ts";

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN");

// Em produção, ALLOWED_ORIGIN deve apontar para o domínio do app (ex.: https://sistema.avizee.com.br).
// Em desenvolvimento ou quando a variável não está definida, fazemos fallback para "*"
// para evitar bloqueio total de CORS — porém a Edge Function continua exigindo JWT válido.
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

// ── Autenticação JWT ─────────────────────────────────────────────

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

/**
 * Mapa de autorização por `action`. Cada entrada lista as permissões que,
 * se concedidas, autorizam a chamada. Admin global (user_roles=admin) ignora
 * o mapa. Actions ausentes são bloqueadas por padrão.
 */
const ACTION_PERMISSIONS: Record<string, PermissionRequirement[]> = {
  "health": [
    { resource: "faturamento_fiscal", action: "visualizar" },
    { resource: "faturamento_fiscal", action: "admin_fiscal" },
  ],
  "parse-certificado": [
    { resource: "faturamento_fiscal", action: "admin_fiscal" },
  ],
  "assinar-e-enviar-vault": [
    { resource: "faturamento_fiscal", action: "criar" },
    { resource: "faturamento_fiscal", action: "cancelar" },
    { resource: "faturamento_fiscal", action: "admin_fiscal" },
  ],
  "enviar-sem-assinatura-vault": [
    { resource: "faturamento_fiscal", action: "visualizar" },
    { resource: "faturamento_fiscal", action: "criar" },
    { resource: "faturamento_fiscal", action: "cancelar" },
    { resource: "faturamento_fiscal", action: "admin_fiscal" },
  ],
};

// ── Certificado: Parsing PFX ─────────────────────────────────────

interface CertificadoInfo {
  cnpj: string;
  razaoSocial: string;
  validadeInicio: string;
  validadeFim: string;
  diasRestantes: number;
}

// ── Helpers PFX (centralizados em _shared/pfx.ts) ────────────────
import {
  parseCertificado,
  extrairChaveECertificado,
  pfxToPem,
} from "../_shared/pfx.ts";

// ── Assinatura Digital XML (xmldsig RSA-SHA1) ────────────────────

import { canonicalizeExclusive } from "../_shared/xml-c14n.ts";

/**
 * Canonicalização XML.
 *
 * Default: implementação naïve legada (apenas remove declaração XML e
 * normaliza CRLF). Mantida como fallback enquanto o C14N real não é
 * validado em homologação SEFAZ.
 *
 * Quando `SEFAZ_C14N_REAL=true` no env, usa exclusive C14N real
 * (parsing DOM, ordenação de atributos, escapes corretos).
 * Veja supabase/functions/_shared/xml-c14n.ts.
 */
const USE_C14N_REAL = Deno.env.get("SEFAZ_C14N_REAL") === "true";

function canonicalize(xml: string): string {
  if (USE_C14N_REAL) {
    try {
      return canonicalizeExclusive(xml);
    } catch (e) {
      console.warn("[sefaz-proxy] C14N real falhou, usando fallback legado:", (e as Error).message);
    }
  }
  return xml
    .replace(/<\?xml[^?]*\?>\s*/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function assinarXml(xml: string, base64Pfx: string, senha: string): string {
  const { privateKey, cert } = extrairChaveECertificado(base64Pfx, senha);

  const infNFeOriginal = xml.match(/<infNFe[^>]*>[\s\S]*?<\/infNFe>/)?.[0];
  if (!infNFeOriginal) throw new Error("Elemento <infNFe> não encontrado no XML.");

  const idMatch = infNFeOriginal.match(/Id="([^"]+)"/);
  if (!idMatch) throw new Error("Atributo Id do <infNFe> não encontrado.");
  const referenceUri = `#${idMatch[1]}`;

  // C14N: o subtree assinado herda xmlns do <NFe> pai. A SEFAZ inclui o
  // namespace no infNFe ao canonicalizar; precisamos digerir EXATAMENTE
  // o mesmo. XML já compacto (sem espaços entre tags).
  const infNFeC14N = /<infNFe[^>]*\sxmlns=/.test(infNFeOriginal)
    ? infNFeOriginal
    : infNFeOriginal.replace(
        /^<infNFe(\s)/,
        '<infNFe xmlns="http://www.portalfiscal.inf.br/nfe"$1',
      );

  const digestMd = forge.md.sha1.create();
  digestMd.update(infNFeC14N, "utf8");
  const digestBase64 = forge.util.encode64(digestMd.digest().getBytes());

  const signedInfo =
    '<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">' +
    '<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>' +
    '<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>' +
    `<Reference URI="${referenceUri}">` +
    '<Transforms>' +
    '<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>' +
    '<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>' +
    '</Transforms>' +
    '<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>' +
    `<DigestValue>${digestBase64}</DigestValue>` +
    '</Reference></SignedInfo>';

  const signatureMd = forge.md.sha1.create();
  signatureMd.update(signedInfo, "utf8");
  const signatureBytes = (privateKey as any).sign(signatureMd);
  const signatureBase64 = forge.util.encode64(signatureBytes);

  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const certBase64 = forge.util.encode64(certDer);

  const signatureBlock =
    '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">' +
    signedInfo +
    `<SignatureValue>${signatureBase64}</SignatureValue>` +
    `<KeyInfo><X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data></KeyInfo>` +
    '</Signature>';

  return xml.replace("</infNFe>", `</infNFe>${signatureBlock}`);
}

// ── Envio SOAP para SEFAZ ────────────────────────────────────────

async function enviarSoap(
  xmlAssinado: string,
  url: string,
  soapAction: string,
): Promise<{ sucesso: boolean; xmlRetorno?: string; erro?: string }> {
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl">
  <soapenv:Header/>
  <soapenv:Body>
    <nfe:nfeDadosMsg>${xmlAssinado}</nfe:nfeDadosMsg>
  </soapenv:Body>
</soapenv:Envelope>`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: soapAction,
      },
      body: envelope,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const xmlRetorno = await response.text();

    if (!response.ok) {
      return {
        sucesso: false,
        erro: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    return { sucesso: true, xmlRetorno };
  } catch (err) {
    clearTimeout(timer);
    const message =
      err instanceof Error
        ? err.name === "AbortError"
          ? "Timeout de 30s ao conectar com a SEFAZ"
          : err.message
        : String(err);
    return { sucesso: false, erro: message };
  }
}

// ── Envio SOAP com mTLS (sem assinatura) ─────────────────────────

// `pfxToPem` agora vem de _shared/pfx.ts (com leaf-detection + cadeia completa).

/**
 * Envia um envelope SOAP usando mTLS com o A1 do Vault, sem aplicar XMLDSig.
 * Usado para consultas (ex.: NFeConsultaProtocolo4 / consSitNFe).
 */
async function enviarSoapMtls(
  xmlConteudo: string,
  url: string,
  soapAction: string,
  certPem: string,
  keyPem: string,
): Promise<{
  sucesso: boolean;
  xmlRetorno?: string;
  erro?: string;
  statusHttp?: number;
}> {
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl">
  <soapenv:Header/>
  <soapenv:Body>
    <nfe:nfeDadosMsg>${xmlConteudo}</nfe:nfeDadosMsg>
  </soapenv:Body>
</soapenv:Envelope>`;

  let client: Deno.HttpClient | undefined;
  try {
    // @ts-ignore — http1/http2 são opções específicas do Deno e os legados
    // SEFAZ exigem HTTP/1.1.
    client = Deno.createHttpClient({
      cert: certPem,
      key: keyPem,
      http1: true,
      http2: false,
    });
  } catch (e) {
    return {
      sucesso: false,
      erro: `Falha ao criar cliente mTLS: ${
        e instanceof Error ? e.message : String(e)
      }`,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: soapAction,
      },
      body: envelope,
      // @ts-ignore — option client é específica do Deno
      client,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const xmlRetorno = await response.text();
    if (!response.ok) {
      return {
        sucesso: false,
        erro: `HTTP ${response.status}: ${response.statusText}`,
        statusHttp: response.status,
        xmlRetorno,
      };
    }
    return { sucesso: true, xmlRetorno, statusHttp: response.status };
  } catch (err) {
    clearTimeout(timer);
    const raw = err instanceof Error
      ? err.name === "AbortError"
        ? "Timeout de 30s ao conectar com a SEFAZ"
        : err.message
      : String(err);
    return { sucesso: false, erro: raw };
  } finally {
    try {
      // @ts-ignore — close é estável em Deno
      client?.close?.();
    } catch (_) { /* ignore */ }
  }
}

// ── Handler principal ────────────────────────────────────────────

Deno.serve(async (req) => {
  corsHeaders = buildCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const log = createLogger("sefaz-proxy", req);
  try {
    const user = await requireAuth(req);

    const body = await req.json();
    const { action } = body;
    log.info("request received", { action });

    if (!action || typeof action !== "string") {
      return json(
        {
          error:
            "Campo 'action' ausente. Use 'health', 'parse-certificado', 'assinar-e-enviar-vault' ou 'enviar-sem-assinatura-vault'.",
        },
        400,
      );
    }

    const allowed = ACTION_PERMISSIONS[action];
    if (!allowed) {
      return json(
        { error: `action '${action}' inválida.` },
        400,
      );
    }
    try {
      await requireAnyPermission(user.id, allowed);
    } catch (permErr: any) {
      const status = permErr?.status === 403 ? 403 : 500;
      log.warn("permission denied", { action, userId: user.id, message: permErr?.message });
      return json({ error: permErr.message ?? "Permissão negada" }, status);
    }

    // ── Health check leve ──────────────────────────────────────────
    // Usado pelo painel "Saúde do sistema" (admin) para indicar se a
    // edge function está acessível sem precisar de PFX/SOAP. Retorna
    // também a presença do secret de senha do certificado.
    if (action === "health") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Campos sensíveis (existência do PFX no Vault) só vão para admins
      // fiscais. Usuários com apenas `visualizar` recebem ack mínimo.
      const isFiscalAdmin = await hasAnyPermission(user.id, [
        { resource: "faturamento_fiscal", action: "admin_fiscal" },
      ]);
      const payload: Record<string, unknown> = {
        ok: true,
        action: "health",
        timestamp: new Date().toISOString(),
      };
      if (isFiscalAdmin) {
        payload.hasPfxPassword = !!(await getVaultSecretByName(
          adminClient,
          "CERTIFICADO_PFX_SENHA",
        ));
      }
      return json(payload);
    }

    if (action === "parse-certificado") {
      const { certificado_base64, senha } = body;
      if (!certificado_base64 || !senha) {
        return json({ error: "certificado_base64 e senha são obrigatórios" }, 400);
      }
      try {
        const info = parseCertificado(certificado_base64, senha);
        return json(info);
      } catch (e: any) {
        return json(
          { error: `Erro ao ler certificado: ${e.message}` },
          400,
        );
      }
    }

    if (action === "assinar-e-enviar") {
      // Modo legado removido: o certificado A1 deve permanecer server-side
      // (Storage privado + Vault). Use sempre `assinar-e-enviar-vault`.
      return json(
        {
          sucesso: false,
          erro:
            "Action 'assinar-e-enviar' foi descontinuada por segurança. Use 'assinar-e-enviar-vault'.",
        },
        410,
      );
    }

    if (action === "assinar-e-enviar-vault") {
      const { xml, url, soapAction } = body;
      if (!xml || !url || !soapAction) {
        return json(
          { error: "xml, url e soapAction são obrigatórios" },
          400,
        );
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const senha = await getVaultSecretByName(adminClient, "CERTIFICADO_PFX_SENHA");
      if (!senha) {
        return json(
          { sucesso: false, erro: "Senha do certificado não encontrada no cofre seguro." },
          500,
        );
      }

      // Baixar o .pfx do Storage privado dbavizee/certificados/empresa.pfx
      const { data: blob, error: dlErr } = await adminClient.storage
        .from("dbavizee")
        .download("certificados/empresa.pfx");

      if (dlErr || !blob) {
        return json(
          { sucesso: false, erro: `Não foi possível ler o certificado do Storage: ${dlErr?.message ?? "arquivo ausente"}` },
          500,
        );
      }

      const arrBuf = await blob.arrayBuffer();
      const certBase64 = forge.util.encode64(
        String.fromCharCode(...new Uint8Array(arrBuf)),
      );

      let xmlAssinado: string;
      try {
        xmlAssinado = assinarXml(xml, certBase64, senha);
      } catch (e: any) {
        return json({ sucesso: false, erro: `Erro na assinatura: ${e.message}` });
      }

      let certPem: string;
      let keyPem: string;
      try {
        const r = pfxToPem(certBase64, senha);
        certPem = r.certPem;
        keyPem = r.keyPem;
      } catch (e: any) {
        return json({ sucesso: false, erro: `Falha ao ler PFX: ${e.message ?? String(e)}` });
      }

      const resultado = await enviarSoapMtls(
        xmlAssinado,
        url,
        soapAction,
        certPem,
        keyPem,
      );
      return json(resultado);
    }

    if (action === "enviar-sem-assinatura-vault") {
      const { xml, url, soapAction } = body;
      if (!xml || !url || !soapAction) {
        return json(
          { error: "xml, url e soapAction são obrigatórios" },
          400,
        );
      }

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
            erro:
              "Senha do certificado não encontrada no cofre seguro — reenvie o certificado em Administração > Fiscal.",
          },
          500,
        );
      }

      const { data: blob, error: dlErr } = await adminClient.storage
        .from("dbavizee")
        .download("certificados/empresa.pfx");

      if (dlErr || !blob) {
        return json(
          {
            sucesso: false,
            erro:
              `Não foi possível ler o certificado A1 do Storage: ${
                dlErr?.message ?? "arquivo ausente"
              }`,
          },
          500,
        );
      }

      const arrBuf = await blob.arrayBuffer();
      const certBase64 = forge.util.encode64(
        String.fromCharCode(...new Uint8Array(arrBuf)),
      );

      let certPem: string;
      let keyPem: string;
      try {
        const r = pfxToPem(certBase64, senha);
        certPem = r.certPem;
        keyPem = r.keyPem;
      } catch (e: any) {
        return json({
          sucesso: false,
          erro: `Falha ao ler PFX: ${e.message ?? String(e)}`,
        });
      }

      const resultado = await enviarSoapMtls(
        xml,
        url,
        soapAction,
        certPem,
        keyPem,
      );
      return json(resultado);
    }

    return json(
      {
        error: `action '${action}' inválida. Use 'health', 'parse-certificado', 'assinar-e-enviar-vault' ou 'enviar-sem-assinatura-vault'.`,
      },
      400,
    );
  } catch (err: any) {
    log.error("request failed", err);
    return json({ error: err.message || "Erro interno" }, err.message?.includes("Sessão") ? 401 : 500);
  }
});
