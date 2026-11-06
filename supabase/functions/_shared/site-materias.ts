// deno-lint-ignore-file no-explicit-any
/**
 * Integração ERP → site AviZee (matérias da Central de Conteúdos).
 *
 * Usado pela Edge Function `site-publicar-materia` e pelo conector MCP.
 * Fala com a API interna do site (`/api/internal/erp/*`), autenticada pelo
 * segredo `SITE_ERP_CONTENT_SECRET`. O segredo nunca sai das Edge Functions.
 *
 * Contrato: docs/avizee/561-erp-content-integration.md (repositório do site).
 */
import { fetchWithTimeout } from "./validate.ts";

const SITE_TIMEOUT_MS = 30_000;

export class SiteIntegrationError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly cause_?: string,
  ) {
    super(message);
  }
}

function siteConfig() {
  const baseUrl = (Deno.env.get("SITE_BASE_URL") ?? "").replace(/\/+$/, "");
  const secret = Deno.env.get("SITE_ERP_CONTENT_SECRET") ?? "";
  if (!/^https:\/\//.test(baseUrl) || secret.length < 32) {
    throw new SiteIntegrationError("Integração com o site não configurada.", 503);
  }
  return { baseUrl, secret };
}

async function callSite(path: string, init: RequestInit = {}): Promise<any> {
  const { baseUrl, secret } = siteConfig();
  const res = await fetchWithTimeout(
    `${baseUrl}${path}`,
    {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
    },
    SITE_TIMEOUT_MS,
  );
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok || body?.ok !== true) {
    const cause = typeof body?.cause === "string" ? body.cause : undefined;
    const code = typeof body?.error === "string" ? body.error : `HTTP_${res.status}`;
    throw new SiteIntegrationError(
      cause ? `${code}: ${cause}` : code,
      res.status >= 400 ? res.status : 502,
      cause,
    );
  }
  return body;
}

export async function buscarReferenciasSite() {
  const body = await callSite("/api/internal/erp/referencias", { method: "GET" });
  return { categorias: body.categories ?? [], familias: body.families ?? [] };
}

export async function buscarMateriasSite(q: string) {
  const body = await callSite(`/api/internal/erp/materias?q=${encodeURIComponent(q)}`, {
    method: "GET",
  });
  return body.items ?? [];
}

/**
 * Publica no site uma matéria APROVADA do ERP.
 *
 * `admin` é um cliente service_role: o trigger da tabela só aceita os campos
 * de retorno do site vindos do service_role. A reivindicação do registro
 * (`aprovada|erro` → `publicando`) é atômica, para evitar envio duplo.
 */
export async function publicarMateriaNoSite(admin: any, materiaId: string, atorId: string) {
  const { data: claimed, error: claimErr } = await admin
    .from("site_materias")
    .update({ status: "publicando" })
    .eq("id", materiaId)
    .in("status", ["aprovada", "erro"])
    .not("aprovado_em", "is", null)
    .select("*")
    .maybeSingle();
  if (claimErr) throw new SiteIntegrationError(`Falha ao reservar matéria: ${claimErr.message}`, 500);
  if (!claimed) {
    throw new SiteIntegrationError(
      "A matéria precisa estar aprovada (e não estar em publicação) para ser publicada.",
      409,
    );
  }

  const m = claimed;
  const payload = {
    articleId: m.site_artigo_id ?? null,
    externalId: m.id,
    title: m.titulo,
    subtitle: m.subtitulo ?? null,
    slug: m.slug ?? null,
    excerpt: m.resumo ?? "",
    categorySlug: m.categoria_slug,
    seoTitle: m.seo_titulo ?? null,
    seoDescription: m.seo_descricao ?? null,
    blocks: m.blocos ?? [],
    sources: m.fontes ?? [],
    author: { name: m.autor_nome },
    approvedBy: { name: m.aprovado_por_nome },
    verificationNotes: m.notas_verificacao ?? null,
    publish: true,
  };

  try {
    const result = await callSite("/api/internal/erp/materias", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const { data: updated, error: updErr } = await admin
      .from("site_materias")
      .update({
        status: "publicada",
        site_artigo_id: result.articleId,
        site_url: result.url ?? null,
        site_versao: result.version ?? null,
        slug: result.slug ?? m.slug,
        publicado_em: new Date().toISOString(),
        ultimo_erro: null,
      })
      .eq("id", materiaId)
      .select("id, status, site_url, site_artigo_id, publicado_em")
      .single();
    if (updErr) throw new SiteIntegrationError(`Publicado, mas falhou ao registrar: ${updErr.message}`, 500);
    await admin.from("site_materias_eventos").insert({
      materia_id: materiaId,
      tipo: "publicacao_site",
      ator: atorId,
      detalhe: {
        site_artigo_id: result.articleId,
        versao: result.version ?? null,
        familias_desconhecidas: result.unknownFamilies ?? [],
      },
    });
    return { ...updated, familias_desconhecidas: result.unknownFamilies ?? [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin
      .from("site_materias")
      .update({ status: "erro", ultimo_erro: message.slice(0, 1000) })
      .eq("id", materiaId);
    await admin.from("site_materias_eventos").insert({
      materia_id: materiaId,
      tipo: "erro_publicacao_site",
      ator: atorId,
      detalhe: { erro: message.slice(0, 1000) },
    });
    throw err instanceof SiteIntegrationError ? err : new SiteIntegrationError(message, 502);
  }
}
