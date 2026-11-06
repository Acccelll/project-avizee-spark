// deno-lint-ignore-file no-explicit-any
/**
 * Publicação de uma matéria no Instagram (Graph API, conta Business/Creator).
 *
 * Fluxo da Meta: cria o contêiner de mídia (`/{ig-user-id}/media`, com
 * `image_url` público + legenda) e publica (`/{ig-user-id}/media_publish`).
 * O token da conta vem do Vault (`social_obter_credenciais`), nunca do cliente.
 * Exige o escopo `instagram_content_publish` concedido na conexão da conta.
 */
import { fetchWithTimeout } from "./validate.ts";

const GRAPH = "https://graph.facebook.com/v19.0";
const TIMEOUT_MS = 30_000;

export class InstagramPublishError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Legenda no formato editorial da AviZee: Título / Texto / Fonte: nome. */
export function montarLegenda(m: {
  instagram_titulo?: string | null;
  instagram_texto?: string | null;
  instagram_fonte?: string | null;
}): string {
  const titulo = (m.instagram_titulo ?? "").trim();
  const texto = (m.instagram_texto ?? "").trim();
  const fonte = (m.instagram_fonte ?? "").trim();
  if (!titulo || !texto || !fonte) {
    throw new InstagramPublishError(
      "O post do Instagram precisa de título, texto e fonte preenchidos na matéria.",
      422,
    );
  }
  const legenda = `${titulo}\n\n${texto}\n\nFonte: ${fonte.replace(/^fonte:\s*/i, "")}`;
  if (legenda.length > 2200) {
    throw new InstagramPublishError("A legenda passa de 2.200 caracteres (limite do Instagram).", 422);
  }
  return legenda;
}

async function graph(path: string, params: Record<string, string>, method = "POST") {
  const url = `${GRAPH}${path}`;
  const body = new URLSearchParams(params);
  const res = await fetchWithTimeout(
    method === "GET" ? `${url}?${body}` : url,
    method === "GET" ? {} : { method, body },
    TIMEOUT_MS,
  );
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) {
    const msg = json?.error?.message ?? `HTTP ${res.status}`;
    throw new InstagramPublishError(`Instagram: ${msg}`, 502);
  }
  return json;
}

/**
 * Publica a matéria no Instagram. `admin` é cliente service_role.
 * Reserva atômica `nao_postado|erro → postando` evita post duplicado.
 */
export async function publicarMateriaNoInstagram(
  admin: any,
  materiaId: string,
  imagemUrl: string,
  atorId: string,
  contaId?: string,
) {
  if (!/^https:\/\//i.test(imagemUrl)) {
    throw new InstagramPublishError("A imagem precisa de uma URL https pública.", 422);
  }

  const { data: materia, error: mErr } = await admin
    .from("site_materias")
    .select("id, status, instagram_titulo, instagram_texto, instagram_fonte, instagram_status")
    .eq("id", materiaId)
    .maybeSingle();
  if (mErr) throw new InstagramPublishError(`Falha ao ler matéria: ${mErr.message}`, 500);
  if (!materia) throw new InstagramPublishError("Matéria não encontrada.", 404);
  if (!["aprovada", "publicada"].includes(materia.status)) {
    throw new InstagramPublishError("Só matérias aprovadas ou publicadas vão para o Instagram.", 409);
  }
  const legenda = montarLegenda(materia);

  let query = admin
    .from("social_contas")
    .select("id, identificador_externo, nome_conta")
    .eq("plataforma", "instagram_business")
    .eq("ativo", true);
  if (contaId) query = query.eq("id", contaId);
  const { data: contas, error: cErr } = await query.limit(2);
  if (cErr) throw new InstagramPublishError(`Falha ao ler contas: ${cErr.message}`, 500);
  if (!contas?.length) {
    throw new InstagramPublishError("Nenhuma conta do Instagram conectada no ERP.", 422);
  }
  if (contas.length > 1 && !contaId) {
    throw new InstagramPublishError("Há mais de uma conta conectada; informe conta_id.", 409);
  }
  const conta = contas[0];

  const { data: cred } = await admin
    .rpc("social_obter_credenciais", { _conta_id: conta.id })
    .maybeSingle();
  const token = (cred as { access_token?: string } | null)?.access_token;
  if (!token) {
    throw new InstagramPublishError("A conta conectada não tem token salvo; reconecte no ERP.", 422);
  }

  const { data: claimed } = await admin
    .from("site_materias")
    .update({ instagram_status: "postando" })
    .eq("id", materiaId)
    .in("instagram_status", ["nao_postado", "erro"])
    .select("id")
    .maybeSingle();
  if (!claimed) {
    throw new InstagramPublishError("Esta matéria já foi (ou está sendo) postada no Instagram.", 409);
  }

  try {
    const container = await graph(`/${conta.identificador_externo}/media`, {
      image_url: imagemUrl,
      caption: legenda,
      access_token: token,
    });
    const published = await graph(`/${conta.identificador_externo}/media_publish`, {
      creation_id: container.id,
      access_token: token,
    });
    const info = await graph(`/${published.id}`, { fields: "permalink", access_token: token }, "GET")
      .catch(() => ({}));

    const { data: post } = await admin
      .from("social_posts")
      .insert({
        conta_id: conta.id,
        id_externo_post: published.id,
        plataforma: "instagram_business",
        tipo: "IMAGE",
        tipo_post: "feed",
        conteudo: legenda,
        titulo_legenda: materia.instagram_titulo,
        url_post: info?.permalink ?? null,
        data_publicacao: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();

    await admin
      .from("site_materias")
      .update({
        instagram_status: "postado",
        instagram_post_id: post?.id ?? null,
        instagram_url: info?.permalink ?? null,
      })
      .eq("id", materiaId);
    await admin.from("site_materias_eventos").insert({
      materia_id: materiaId,
      tipo: "publicacao_instagram",
      ator: atorId,
      detalhe: { conta: conta.nome_conta, media_id: published.id, url: info?.permalink ?? null },
    });
    return { media_id: published.id, url: info?.permalink ?? null, conta: conta.nome_conta };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin
      .from("site_materias")
      .update({ instagram_status: "erro", ultimo_erro: message.slice(0, 1000) })
      .eq("id", materiaId);
    await admin.from("site_materias_eventos").insert({
      materia_id: materiaId,
      tipo: "erro_publicacao_instagram",
      ator: atorId,
      detalhe: { erro: message.slice(0, 1000) },
    });
    throw err instanceof InstagramPublishError ? err : new InstagramPublishError(message, 502);
  }
}
