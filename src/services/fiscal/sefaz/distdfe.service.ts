/**
 * DistDF-e — orquestrador cliente.
 *
 * Chama a edge function `sefaz-distdfe` (que faz mTLS contra o Ambiente
 * Nacional usando o A1 do storage) e persiste os documentos retornados em
 * `nfe_distribuicao`, atualizando `nfe_distdfe_sync.ultimo_nsu`.
 *
 * Idempotência:
 *  - inserção em `nfe_distribuicao` faz `upsert` por `chave_acesso`.
 *  - documentos sem chave (eventos avulsos) são ignorados nesta onda.
 */

import { supabase } from "@/integrations/supabase/client";

// ── Helpers de ambiente e circuit breaker ────────────────────────

/**
 * Lê o ambiente SEFAZ configurado em empresa_config.
 * Prioridade: ambiente_sefaz ("1"/"2") > ambiente_padrao ("producao"/"homologacao").
 * Fallback conservador: "2" (homologação).
 */
export async function resolverAmbienteDistDFe(): Promise<"1" | "2"> {
  try {
    const { data: cfg } = await supabase
      .from("empresa_config")
      .select("ambiente_sefaz, ambiente_padrao")
      .limit(1)
      .maybeSingle();
    const c = cfg as { ambiente_sefaz?: string | null; ambiente_padrao?: string | null } | null;
    if (c?.ambiente_sefaz === "1" || c?.ambiente_sefaz === "2") {
      return c.ambiente_sefaz as "1" | "2";
    }
    if (c?.ambiente_padrao === "producao") return "1";
    if (c?.ambiente_padrao === "homologacao") return "2";
  } catch {
    // fallback conservador
  }
  return "2";
}

export interface CircuitBreakerInfo {
  ativo: boolean;
  /** ISO timestamp até quando o bloqueio está ativo. */
  ate?: string;
  /** Minutos restantes arredondados. */
  minutosRestantes?: number;
}

/**
 * Verifica se o circuit breaker de cStat 656 está ativo para o ambiente.
 * Consulta app_configuracoes chave `distdfe_circuit_break_until_<ambiente>`.
 */
export async function verificarCircuitBreaker(
  ambiente: "1" | "2",
): Promise<CircuitBreakerInfo> {
  try {
    const chave = `distdfe_circuit_break_until_${ambiente}`;
    const { data } = await supabase
      .from("app_configuracoes")
      .select("valor")
      .eq("chave", chave)
      .maybeSingle();
    const until = (data?.valor as { until?: string } | null)?.until;
    if (until) {
      const diff = new Date(until).getTime() - Date.now();
      if (diff > 0) {
        return {
          ativo: true,
          ate: until,
          minutosRestantes: Math.ceil(diff / 60_000),
        };
      }
    }
  } catch {
    // fail-open: não bloqueia se não conseguir ler
  }
  return { ativo: false };
}

export interface DistDFeDoc {
  nsu: string;
  schema: string;
  xml: string;
  chave?: string;
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

export interface DistDFeResponse {
  sucesso: boolean;
  cnpj?: string;
  ambiente?: "1" | "2";
  cStat?: string;
  xMotivo?: string;
  mensagemCstat?: string | null;
  ultNSU?: string;
  maxNSU?: string;
  docs?: DistDFeDoc[];
  erro?: string;
}

export interface DistDFeStatus {
  sucesso: boolean;
  proxyEnabled: boolean;
  hasProxyUrl: boolean;
  hasProxySecret: boolean;
  flagAtiva: boolean;
  flagLen: number;
  transporte: "cf-worker-mtls" | "deno-mtls-direto" | string;
  erro?: string;
}

/**
 * Consulta status de transporte (Worker mTLS) sem disparar SEFAZ.
 * Usado pelo Histórico DistDF-e para exibir indicador visual de saúde.
 */
export async function obterStatusDistDFe(): Promise<DistDFeStatus> {
  const { data, error } = await supabase.functions.invoke<DistDFeStatus>(
    "sefaz-distdfe",
    { body: { action: "status" } },
  );
  if (error) {
    return {
      sucesso: false,
      proxyEnabled: false,
      hasProxyUrl: false,
      hasProxySecret: false,
      flagAtiva: false,
      flagLen: 0,
      transporte: "desconhecido",
      erro: error.message,
    };
  }
  return data ?? {
    sucesso: false,
    proxyEnabled: false,
    hasProxyUrl: false,
    hasProxySecret: false,
    flagAtiva: false,
    flagLen: 0,
    transporte: "desconhecido",
    erro: "Sem resposta",
  };
}

export interface WorkerPingResult {
  sucesso: boolean;
  ambiente: "1" | "2";
  targetUrl?: string;
  statusHttp?: number;
  statusText?: string;
  bytes?: number;
  preview?: string;
  diagnostico?: string;
  erro?: string;
}

/**
 * Faz um GET ao WSDL do NFeDistribuicaoDFe através do Cloudflare Worker mTLS,
 * sem montar envelope SOAP. Isola binding/allowlist do envelope.
 */
export async function testarWorkerDistDFe(
  ambiente: "1" | "2",
): Promise<WorkerPingResult> {
  const { data, error } = await supabase.functions.invoke<WorkerPingResult>(
    "sefaz-distdfe",
    { body: { action: "worker-ping", ambiente } },
  );
  if (error) {
    return { sucesso: false, ambiente, erro: error.message, diagnostico: error.message };
  }
  return (
    data ?? {
      sucesso: false,
      ambiente,
      erro: "Sem resposta",
      diagnostico: "Sem resposta",
    }
  );
}

/**
 * Consulta documentos novos a partir do último NSU sincronizado para o CNPJ.
 * Persiste resultados e devolve estatística da sincronização.
 *
 * `ambiente` é opcional: quando omitido, resolve automaticamente a partir de
 * empresa_config para evitar que callers hardcoded em "2" causem 656 em produção.
 */
export async function sincronizarDistDFe(
  ambiente?: "1" | "2",
): Promise<{
  sucesso: boolean;
  novos: number;
  duplicados: number;
  ultNSU?: string;
  maxNSU?: string;
  cStat?: string;
  xMotivo?: string;
  erro?: string;
  circuitBreaker?: CircuitBreakerInfo;
}> {
  // Resolve ambiente a partir de empresa_config quando não informado.
  const ambienteResolvido: "1" | "2" = ambiente ?? await resolverAmbienteDistDFe();

  // Verifica circuit breaker antes de qualquer chamada SEFAZ.
  const cb = await verificarCircuitBreaker(ambienteResolvido);
  if (cb.ativo) {
    return {
      sucesso: false,
      novos: 0,
      duplicados: 0,
      cStat: "656",
      xMotivo: `Consumo Indevido — aguarde ~${cb.minutosRestantes} min antes de tentar novamente.`,
      erro: `Circuit breaker ativo até ${cb.ate ? new Date(cb.ate).toLocaleTimeString("pt-BR") : "?"}. Aguarde ${cb.minutosRestantes} minuto(s).`,
      circuitBreaker: cb,
    };
  }

  // 1) Buscar CNPJ via edge function (que extrai do A1) — aqui usamos o
  //    valor armazenado em `nfe_distdfe_sync` se existir; senão começa em '0'
  //    e a edge function preenche o CNPJ.

  // Sondagem inicial: tenta obter um registro de sync existente (qualquer CNPJ);
  // a edge function retorna o CNPJ correto e atualizamos depois.
  const { data: syncs } = await supabase
    .from("nfe_distdfe_sync")
    .select("cnpj, ultimo_nsu")
    .eq("ambiente", ambienteResolvido)
    .limit(1);
  const ultNSU = syncs?.[0]?.ultimo_nsu ?? "0";

  // 2) Chama edge function
  const { data, error } = await supabase.functions.invoke<DistDFeResponse>(
    "sefaz-distdfe",
    { body: { action: "consultar-nsu", ambiente: ambienteResolvido, ultNSU } },
  );
  if (error) {
    return { sucesso: false, novos: 0, duplicados: 0, erro: error.message };
  }
  if (!data?.sucesso) {
    return {
      sucesso: false,
      novos: 0,
      duplicados: 0,
      cStat: data?.cStat,
      xMotivo: data?.xMotivo,
      erro: data?.erro ?? "Resposta inesperada do Ambiente Nacional",
    };
  }

  // cStat 656 = bloqueio por consumo indevido — a Edge retorna sucesso:true mas
  // com docs:[] e cStat=656. Tratar explicitamente como erro para que o caller
  // exiba mensagem correta e não mostre "0 novos" enganosamente.
  if (data.cStat === "656") {
    return {
      sucesso: false,
      novos: 0,
      duplicados: 0,
      cStat: "656",
      xMotivo: data.xMotivo ?? "Consumo Indevido",
      erro: "O Ambiente Nacional bloqueou consultas para este CNPJ por aproximadamente 1 hora (cStat 656). Aguarde antes de tentar novamente.",
      circuitBreaker: { ativo: true, minutosRestantes: 60 },
    };
  }

  // 3) Persiste documentos (apenas os com chave de NF-e)
  const docs = (data.docs ?? []).filter((d) => d.chave && /^\d{44}$/.test(d.chave));
  let novos = 0;
  let duplicados = 0;
  const { data: { user } } = await supabase.auth.getUser();

  for (const d of docs) {
    const r = d.resumo ?? {};
    // Classifica o schema DistDFe para persistir tipo_documento corretamente.
    // Sem isso, upsert com ignoreDuplicates:false sobrescreveria para o DEFAULT
    // 'resNFe' qualquer nota já inserida pelo cron com tipo 'procNFe'.
    const schema = (d.schema ?? "").toLowerCase();
    let tipoDocumento: "procNFe" | "resNFe" | "resEvento" | "procEventoNFe" = "resNFe";
    if (schema.includes("proceventonfe")) tipoDocumento = "procEventoNFe";
    else if (schema.includes("resevento")) tipoDocumento = "resEvento";
    else if (schema.includes("procnfe")) tipoDocumento = "procNFe";
    else if (schema.includes("resnfe")) tipoDocumento = "resNFe";

    const payload = {
      chave_acesso: d.chave!,
      nsu: d.nsu,
      cnpj_emitente: r.cnpjEmitente ?? null,
      nome_emitente: r.nomeEmitente ?? null,
      numero: r.numero ?? null,
      serie: r.serie ?? null,
      data_emissao: r.dataEmissao ?? null,
      valor_total: r.valorTotal ?? null,
      status_manifestacao: "sem_manifestacao",
      tipo_documento: tipoDocumento,
      xml_nfe: tipoDocumento === "procNFe" ? d.xml ?? null : null,
      usuario_id: user?.id ?? null,
    };
    const { error: upErr, data: upData } = await supabase
      .from("nfe_distribuicao")
      .upsert(payload, { onConflict: "chave_acesso", ignoreDuplicates: false })
      .select("id")
      .maybeSingle();
    if (upErr) {
      // 23505 indica conflito de unique não resolvido por upsert — conta como duplicado
      if ((upErr as { code?: string }).code === "23505") duplicados++;
      continue;
    }
    if (upData) novos++;
  }

  // 4) Atualiza nfe_distdfe_sync (upsert por cnpj+ambiente)
  if (data.cnpj) {
    await supabase.from("nfe_distdfe_sync").upsert(
      {
        cnpj: data.cnpj,
        ambiente: ambienteResolvido,
        ultimo_nsu: data.ultNSU ?? ultNSU,
        max_nsu: data.maxNSU ?? null,
        ultima_sync_at: new Date().toISOString(),
        ultima_resposta_cstat: data.cStat ?? null,
        ultima_resposta_xmotivo: data.xMotivo ?? null,
        ultima_qtd_docs: docs.length,
      },
      { onConflict: "cnpj,ambiente" },
    );
  }

  return {
    sucesso: true,
    novos,
    duplicados,
    ultNSU: data.ultNSU,
    maxNSU: data.maxNSU,
    cStat: data.cStat,
    xMotivo: data.xMotivo,
  };
}

/**
 * Consulta direta de uma NF-e por chave de acesso via DistDFe `consChNFe`.
 *
 * Estratégia em 2 níveis (mem://features/fiscal-consulta-por-chave):
 *   1. Cache local: `nfe_distribuicao.xml_nfe WHERE chave_acesso = ?`
 *      (alimentado pelo cron e por consultas anteriores).
 *   2. SEFAZ: edge `sefaz-distdfe` action `consultar-chave`.
 *
 * Após sucesso na SEFAZ, faz upsert em `nfe_distribuicao(chave_acesso,
 * xml_nfe)` para cachear a próxima consulta.
 */
export async function consultarNFePorChave(params: {
  chave: string;
  ambiente?: "1" | "2";
}): Promise<{
  sucesso: boolean;
  origem: "cache" | "sefaz";
  xml?: string;
  cStat?: string;
  xMotivo?: string;
  mensagemCstat?: string | null;
  erro?: string;
}> {
  const chave = (params.chave || "").replace(/\D/g, "");
  const ambiente: "1" | "2" = params.ambiente === "2" ? "2" : "1";
  if (chave.length !== 44) {
    return { sucesso: false, origem: "sefaz", erro: "Chave de acesso inválida (exige 44 dígitos)." };
  }

  // 1) Cache local — `xml_nfe` quando preenchido pelo cron ou consulta prévia.
  try {
    const { data: cache } = await supabase
      .from("nfe_distribuicao")
      .select("xml_nfe")
      .eq("chave_acesso", chave)
      .maybeSingle();
    const xmlCache = (cache as { xml_nfe?: string } | null)?.xml_nfe;
    if (xmlCache && xmlCache.includes("<")) {
      return { sucesso: true, origem: "cache", xml: xmlCache };
    }
  } catch { /* noop — segue para SEFAZ */ }

  // 2) SEFAZ via edge function.
  const { data, error } = await supabase.functions.invoke<DistDFeResponse>(
    "sefaz-distdfe",
    { body: { action: "consultar-chave", ambiente, chNFe: chave } },
  );
  if (error) return { sucesso: false, origem: "sefaz", erro: error.message };
  if (!data?.sucesso) {
    return {
      sucesso: false,
      origem: "sefaz",
      cStat: data?.cStat,
      xMotivo: data?.xMotivo,
      mensagemCstat: data?.mensagemCstat ?? null,
      erro: data?.erro ?? data?.xMotivo ?? "Falha na consulta DistDFe.",
    };
  }

  // Procura o doc com a chave e schema procNFe (XML completo). cStat 138 +
  // documentos = sucesso da chamada (pode vir 1 procNFe). 137 = não encontrado.
  const docs = (data.docs ?? []).filter((d) => d.chave === chave && d.xml);
  const doc = docs.find((d) => /procNFe|nfeProc/.test(d.schema)); // NÃO cair em docs[0]
  const xml = doc?.xml;

  if (!xml) {
    const soResumo = docs.length > 0;
    return {
      sucesso: false,
      origem: "sefaz",
      cStat: data.cStat,
      xMotivo: data.xMotivo,
      mensagemCstat: data.mensagemCstat ?? null,
      erro: soResumo
        ? "A SEFAZ devolveu apenas o resumo (resNFe) desta NF-e, sem o XML completo. Manifeste a nota (Ciência/Confirmação) ou solicite o XML ao emissor."
        : data.cStat === "137" || data.cStat === "138"
          ? `${data.xMotivo ?? "Documento não encontrado"} — ${data.cStat === "138"
              ? "a chave existe mas a NF-e não é destinada ao CNPJ deste certificado A1. Solicite o XML ao emissor."
              : "verifique se a chave está correta."}`
          : data.xMotivo ?? "Resposta sem XML.",
    };
  }

  // Cacheia em `nfe_distribuicao` para próximas consultas.
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("nfe_distribuicao").upsert(
      {
        chave_acesso: chave,
        xml_nfe: xml,
        nsu: doc?.nsu ?? "0",
        cnpj_emitente: doc?.resumo?.cnpjEmitente ?? null,
        nome_emitente: doc?.resumo?.nomeEmitente ?? null,
        numero: doc?.resumo?.numero ?? null,
        serie: doc?.resumo?.serie ?? null,
        data_emissao: doc?.resumo?.dataEmissao ?? null,
        valor_total: doc?.resumo?.valorTotal ?? null,
        status_manifestacao: "sem_manifestacao",
        usuario_id: user?.id ?? null,
      },
      { onConflict: "chave_acesso", ignoreDuplicates: false },
    );
  } catch { /* cache best-effort */ }

  return {
    sucesso: true,
    origem: "sefaz",
    xml,
    cStat: data.cStat,
    xMotivo: data.xMotivo,
    mensagemCstat: data.mensagemCstat ?? null,
  };
}

/** Decodifica base64 (UTF-8) para string. */
function fromBase64Utf8(b64: string): string {
  try {
    const bin = atob(b64.replace(/\s+/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return "";
  }
}

/** Extrai XML completo do payload da API consultadanfe. */
function extrairXmlConsultaDanfe(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  if (typeof obj.xml_base64 === "string" && obj.xml_base64.length > 0) {
    const decoded = fromBase64Utf8(obj.xml_base64);
    if (decoded.includes("<")) return decoded;
  }
  const candidatos = [obj.xml, obj.xmlNfe, obj.xml_nfe];
  for (const c of candidatos) {
    if (typeof c === "string" && c.includes("<")) return c;
  }
  return null;
}

function extrairMensagemConsultaDanfe(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  const m = obj.message ?? obj.error ?? obj.mensagem;
  return typeof m === "string" ? m : null;
}

/** Cacheia o XML obtido em nfe_distribuicao (best-effort). */
async function cachearXmlPorChave(chave: string, xml: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("nfe_distribuicao").upsert(
      {
        chave_acesso: chave,
        xml_nfe: xml,
        nsu: "0",
        status_manifestacao: "sem_manifestacao",
        usuario_id: user?.id ?? null,
      },
      { onConflict: "chave_acesso", ignoreDuplicates: false },
    );
  } catch { /* cache best-effort */ }
}

export type OrigemXmlChave = "cache" | "api" | "sefaz";

/**
 * Caminho oficial de consulta de NF-e por chave.
 * Ordem: cache local -> consultadanfe (primário) -> SEFAZ consChNFe (último recurso).
 */
export async function obterXmlNFePorChave(params: {
  chave: string;
}): Promise<{
  sucesso: boolean;
  origem: OrigemXmlChave;
  xml?: string;
  erro?: string;
}> {
  const chave = (params.chave || "").replace(/\D/g, "");
  if (chave.length !== 44) {
    return { sucesso: false, origem: "api", erro: "Chave de acesso inválida (exige 44 dígitos)." };
  }

  // 1) Cache local
  try {
    const { data: cache } = await supabase
      .from("nfe_distribuicao")
      .select("xml_nfe")
      .eq("chave_acesso", chave)
      .maybeSingle();
    const xmlCache = (cache as { xml_nfe?: string } | null)?.xml_nfe;
    if (xmlCache && xmlCache.includes("<")) {
      return { sucesso: true, origem: "cache", xml: xmlCache };
    }
  } catch { /* segue para consultadanfe */ }

  // 2) consultadanfe (primário)
  let erroConsultaDanfe = "Falha ao consultar a NF-e.";
  try {
    const { data, error } = await supabase.functions.invoke("consultadanfe-proxy", {
      body: { action: "consulta", chave },
    });
    if (error) {
      erroConsultaDanfe = error.message ?? erroConsultaDanfe;
    } else {
      const resp = data as { ok?: boolean; status?: number; data?: unknown; error?: string };
      if (resp?.ok) {
        const xml = extrairXmlConsultaDanfe(resp.data);
        if (xml) {
          await cachearXmlPorChave(chave, xml);
          return { sucesso: true, origem: "api", xml };
        }
        erroConsultaDanfe = "consultadanfe respondeu sem XML.";
      } else {
        const msg = extrairMensagemConsultaDanfe(resp?.data) ?? resp?.error ?? `Status ${resp?.status}`;
        erroConsultaDanfe = `consultadanfe: ${msg}`;
      }
    }
  } catch (err) {
    erroConsultaDanfe = err instanceof Error ? err.message : String(err);
  }

  // 3) SEFAZ consChNFe (último recurso, best-effort)
  try {
    const sefaz = await consultarNFePorChave({ chave });
    if (sefaz.sucesso && sefaz.xml) {
      await cachearXmlPorChave(chave, sefaz.xml);
      return { sucesso: true, origem: "sefaz", xml: sefaz.xml };
    }
  } catch { /* ignora — mantém erro do consultadanfe */ }

  return { sucesso: false, origem: "api", erro: erroConsultaDanfe };
}

// ── Busca retroativa via consNFeDest ──────────────────────────────

export interface BuscaDestinatarioResult {
  sucesso: boolean;
  novas: number;
  duplicadas: number;
  cStat?: string;
  xMotivo?: string;
  ultNSU?: string;
  maxNSU?: string;
  erro?: string;
  /** true quando maxNSU > ultNSU retornado (há mais páginas a consultar). */
  temMais?: boolean;
}

/**
 * Busca NF-e emitidas para o CNPJ da empresa via `consNFeDest`.
 * Independente do cursor NSU do DistDFe — permite recuperação retroativa.
 * SEFAZ entrega até 50 chaves por chamada; use `ultNSU` para paginar.
 */
export async function buscarNFeDestinatario(
  ultNSU?: string,
): Promise<BuscaDestinatarioResult> {
  const ambiente = await resolverAmbienteDistDFe();

  const { data, error } = await supabase.functions.invoke<{
    sucesso: boolean;
    cnpj?: string;
    cStat?: string;
    xMotivo?: string;
    ultNSU?: string;
    maxNSU?: string;
    chaves?: Array<{ chave: string; nsu: string; dhRecbto?: string }>;
    erro?: string;
  }>("sefaz-distdfe", {
    body: {
      action: "consultar-destinatario",
      ambiente,
      ultNSU: ultNSU ?? "0",
      indNFe: "0",
      indEmi: "0",
    },
  });

  if (error) return { sucesso: false, novas: 0, duplicadas: 0, erro: error.message };
  if (!data?.sucesso) {
    return {
      sucesso: false,
      novas: 0,
      duplicadas: 0,
      cStat: data?.cStat,
      xMotivo: data?.xMotivo,
      erro: data?.erro ?? "Resposta inesperada",
    };
  }

  // cStat 138 = NF-e encontradas | 137 = nenhuma
  const chaves = data.chaves ?? [];
  let novas = 0;
  let duplicadas = 0;
  const { data: { user } } = await supabase.auth.getUser();

  for (const item of chaves) {
    if (!/^\d{44}$/.test(item.chave)) continue;
    const payload = {
      chave_acesso: item.chave,
      nsu: item.nsu,
      tipo_documento: "resNFe" as const,
      status_manifestacao: "sem_manifestacao",
      usuario_id: user?.id ?? null,
    };
    const { error: upErr, data: upData } = await supabase
      .from("nfe_distribuicao")
      .upsert(payload, { onConflict: "chave_acesso", ignoreDuplicates: true })
      .select("id")
      .maybeSingle();
    if (upErr) {
      if ((upErr as { code?: string }).code === "23505") duplicadas++;
      continue;
    }
    if (upData) novas++;
    else duplicadas++;
  }

  const ultNSUNum = parseInt(data.ultNSU ?? "0", 10);
  const maxNSUNum = parseInt(data.maxNSU ?? "0", 10);

  return {
    sucesso: true,
    novas,
    duplicadas,
    cStat: data.cStat,
    xMotivo: data.xMotivo,
    ultNSU: data.ultNSU,
    maxNSU: data.maxNSU,
    temMais: maxNSUNum > ultNSUNum,
  };
}