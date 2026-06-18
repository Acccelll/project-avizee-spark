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
import { logger } from "@/lib/logger";

/**
 * Código de erro estável devolvido quando o destinatário da NF-e consultada
 * não corresponde ao CNPJ configurado em `empresa_config`. A UI usa esse
 * prefixo para exibir um toast com ação "Conferir certificado".
 */
export const DEST_MISMATCH_PREFIX = "DEST_MISMATCH";

let _cnpjEmpresaCache: { value: string | null; at: number } | null = null;

/** CNPJ da empresa configurada em `empresa_config` (somente dígitos). Cache 60s. */
async function carregarCnpjEmpresa(): Promise<string | null> {
  const agora = Date.now();
  if (_cnpjEmpresaCache && agora - _cnpjEmpresaCache.at < 60_000) {
    return _cnpjEmpresaCache.value;
  }
  try {
    const { data } = await supabase
      .from("empresa_config")
      .select("cnpj")
      .limit(1)
      .maybeSingle();
    const raw = (data as { cnpj?: string | null } | null)?.cnpj ?? null;
    const digits = raw ? raw.replace(/\D/g, "") : null;
    _cnpjEmpresaCache = { value: digits, at: agora };
    return digits;
  } catch {
    return null;
  }
}

/** Invalida o cache de CNPJ da empresa (após mudança em Administração). */
export function invalidarCnpjEmpresaCache(): void {
  _cnpjEmpresaCache = null;
}

/**
 * Valida se o destinatário do XML corresponde ao CNPJ configurado em
 * `empresa_config`. Retorna `null` se válido; uma string `DEST_MISMATCH: …`
 * pronta para virar `erro` quando inválido.
 */
async function validarDestinatarioPertenceCertificado(
  cnpjDest: string | undefined | null,
  nomeDest: string | undefined | null,
): Promise<string | null> {
  const cnpjEmpresa = await carregarCnpjEmpresa();
  if (!cnpjEmpresa) return null; // empresa sem CNPJ — não bloqueia
  const destDigits = (cnpjDest ?? "").replace(/\D/g, "");
  if (!destDigits) {
    // Sem destinatário identificável no XML — não classificamos como mismatch.
    return null;
  }
  if (destDigits === cnpjEmpresa) return null;
  const fmt = (d: string) =>
    d.length === 14
      ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
      : d.length === 11
        ? d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")
        : d;
  const nomeTxt = nomeDest ? `${nomeDest.trim()} — ` : "";
  return `${DEST_MISMATCH_PREFIX}: Esta NF-e não é destinada ao CNPJ do certificado A1 configurado (${fmt(cnpjEmpresa)}). Destinatário do XML: ${nomeTxt}${fmt(destDigits)}. Verifique o certificado em Administração ou solicite a chave correta.`;
}

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
  opcoes?: { maxLotes?: number; onProgresso?: (info: { lote: number; ultNSU: string; maxNSU: string; novos: number }) => void },
): Promise<{
  sucesso: boolean;
  novos: number;
  duplicados: number;
  novasNFe?: number;
  novosEventos?: number;
  lotes?: number;
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

  // Sondagem inicial: tenta obter um registro de sync existente para o CNPJ
  // do certificado. A edge function devolve o CNPJ correto a cada chamada e
  // atualizamos o `nfe_distdfe_sync` ao fim de cada lote.
  const { data: syncs } = await supabase
    .from("nfe_distdfe_sync")
    .select("cnpj, ultimo_nsu")
    .eq("ambiente", ambienteResolvido)
    .limit(1);
  let ultNSUAtual = syncs?.[0]?.ultimo_nsu ?? "0";

  const { data: { user } } = await supabase.auth.getUser();
  let novos = 0;
  let duplicados = 0;
  let novasNFe = 0;
  let novosEventos = 0;
  let lotes = 0;
  let ultDataResposta: DistDFeResponse | null = null;
  // Limite defensivo: 20 lotes × 50 docs/lote = 1.000 documentos por clique.
  // Cobre meses de backlog sem risco de loop infinito e respeita orçamento de
  // edge function (~ < 60 s no Deno Deploy).
  const maxLotes = Math.max(1, Math.min(opcoes?.maxLotes ?? 20, 50));

  for (let lote = 0; lote < maxLotes; lote++) {
    const { data, error } = await supabase.functions.invoke<DistDFeResponse>(
      "sefaz-distdfe",
      { body: { action: "consultar-nsu", ambiente: ambienteResolvido, ultNSU: ultNSUAtual } },
    );
    if (error) {
      // Falha de rede no meio do lote: devolve o que já foi processado e marca
      // como erro para o caller exibir o motivo.
      return {
        sucesso: lotes > 0,
        novos,
        duplicados,
        novasNFe,
        novosEventos,
        lotes,
        ultNSU: ultNSUAtual,
        maxNSU: ultDataResposta?.maxNSU,
        erro: error.message,
      };
    }
    if (!data?.sucesso) {
      return {
        sucesso: lotes > 0,
        novos,
        duplicados,
        novasNFe,
        novosEventos,
        lotes,
        cStat: data?.cStat,
        xMotivo: data?.xMotivo,
        erro: data?.erro ?? "Resposta inesperada do Ambiente Nacional",
      };
    }

    if (data.cStat === "656") {
      // No 656 (Consumo Indevido) o AN devolve o ultNSU consolidado por CNPJ,
      // NÃO o ponto até onde o cliente já baixou. Avançar o cursor aqui faria
      // pular docs ainda não entregues (51..ultNSU). Mantemos o cursor parado
      // e só persistimos o circuit breaker para evitar novo 656 em loop.
      // Persiste o circuit breaker para o próximo clique cair em
      // `verificarCircuitBreaker` antes de tocar a SEFAZ — evita que o
      // usuário "rebloqueie" o CNPJ por insistir no botão Sincronizar.
      const ate = new Date(Date.now() + 60 * 60_000).toISOString();
      try {
        await supabase
          .from("app_configuracoes")
          .upsert(
            {
              chave: `distdfe_circuit_break_until_${ambienteResolvido}`,
              valor: { until: ate },
            },
            { onConflict: "chave" },
          );
      } catch {
        // best-effort — não derruba o retorno por falha de gravação
      }
      return {
        sucesso: lotes > 0,
        novos,
        duplicados,
        novasNFe,
        novosEventos,
        lotes,
        cStat: "656",
        xMotivo: data.xMotivo ?? "Consumo Indevido",
        ultNSU: ultNSUAtual,
        erro: "O Ambiente Nacional bloqueou consultas para este CNPJ por aproximadamente 1 hora (cStat 656). O cursor foi atualizado — aguarde e tente novamente depois.",
        circuitBreaker: { ativo: true, ate, minutosRestantes: 60 },
      };
    }

    ultDataResposta = data;
    // Fallback: alguns schemas (resNFe, resEvento, procEventoNFe) podem chegar
    // sem `d.chave` extraída. Tentamos resgatar a chave do XML interno antes
    // de descartar. Só descartamos quando, após o fallback, ainda não há
    // chave de 44 dígitos — esse descarte é logado para diagnóstico.
    const docs = (data.docs ?? []).flatMap((d) => {
      if (d.chave && /^\d{44}$/.test(d.chave)) return [d];
      const xml = d.xml ?? "";
      const m =
        xml.match(/<chNFe>(\d{44})<\/chNFe>/) ??
        xml.match(/<chave>(\d{44})<\/chave>/) ??
        xml.match(/Id=["']NFe(\d{44})["']/) ??
        xml.match(/infNFe[^>]*Id=["']NFe(\d{44})["']/);
      if (m?.[1]) return [{ ...d, chave: m[1] }];
      logger.warn("[distdfe] doc descartado sem chave extraível", {
        nsu: d.nsu,
        schema: d.schema,
      });
      return [];
    });
    let novosLote = 0;

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

    const isEvento = tipoDocumento === "resEvento" || tipoDocumento === "procEventoNFe";
    // Eventos chegam DEPOIS da NF-e e compartilham a chave_acesso. Se já existe
    // uma linha com tipo_documento procNFe/resNFe, o upsert padrão sobrescreveria
    // os campos da NF-e (incluindo xml_nfe). Para eventos, verificamos antes e
    // só inserimos quando a chave ainda não existe — evitando "perder" a NF-e
    // do grid após receber o evento de ciência/manifestação.
    if (isEvento) {
      const { data: existente } = await supabase
        .from("nfe_distribuicao")
        .select("id")
        .eq("chave_acesso", d.chave!)
        .maybeSingle();
      if (existente) {
        duplicados++;
        continue;
      }
    }

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
    if (upData) {
      novos++;
      novosLote++;
      if (isEvento) novosEventos++;
      else novasNFe++;
    }
    }

    // Atualiza checkpoint após cada lote — assim, se algo falhar no próximo
    // lote, o NSU não é perdido e a próxima sincronização retoma daqui.
    let novoUltNSU = data.ultNSU ?? ultNSUAtual;
    // Fallback defensivo: se o AN devolveu o mesmo ultNSU que enviamos mas
    // os docZips trazem NSU > cursor, usar o maior NSU recebido. Cobre quirk
    // do envelope SOAP que faz o parser pegar um ultNSU "eco" no lugar do
    // ultNSU de resposta. Se nenhum doc é maior, fica inerte (cursor parado).
    try {
      if (novoUltNSU === ultNSUAtual && data.docs?.length) {
        let maxDocNsu = ultNSUAtual;
        for (const d of data.docs) {
          if (d.nsu && /^\d+$/.test(d.nsu) && BigInt(d.nsu) > BigInt(maxDocNsu)) {
            maxDocNsu = d.nsu;
          }
        }
        if (BigInt(maxDocNsu) > BigInt(ultNSUAtual)) novoUltNSU = maxDocNsu;
      }
    } catch {
      // BigInt parse defensiva — mantém novoUltNSU original
    }
    if (data.cnpj) {
      await supabase.from("nfe_distdfe_sync").upsert(
        {
          cnpj: data.cnpj,
          ambiente: ambienteResolvido,
          ultimo_nsu: novoUltNSU,
          max_nsu: data.maxNSU ?? null,
          ultima_sync_at: new Date().toISOString(),
          ultima_resposta_cstat: data.cStat ?? null,
          ultima_resposta_xmotivo: data.xMotivo ?? null,
          ultima_qtd_docs: docs.length,
        },
        { onConflict: "cnpj,ambiente" },
      );
    }

    lotes++;
    opcoes?.onProgresso?.({ lote: lotes, ultNSU: novoUltNSU, maxNSU: data.maxNSU ?? "0", novos: novosLote });

    // Critérios de parada:
    //  - cStat 137 = "Nenhum documento localizado" (alcançou o fim).
    //  - ultNSU não avançou (proteção contra loop).
    //  - ultNSU >= maxNSU (não há mais nada na fila do AN).
    const avancou = novoUltNSU !== ultNSUAtual;
    ultNSUAtual = novoUltNSU;
    const maxNSU = data.maxNSU ?? "0";
    const fim = !avancou
      || data.cStat === "137"
      || BigInt(ultNSUAtual || "0") >= BigInt(maxNSU || "0");
    if (fim) break;
  }

  return {
    sucesso: true,
    novos,
    duplicados,
    novasNFe,
    novosEventos,
    lotes,
    ultNSU: ultNSUAtual,
    maxNSU: ultDataResposta?.maxNSU,
    cStat: ultDataResposta?.cStat,
    xMotivo: ultDataResposta?.xMotivo,
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
    // Quando vem de consChNFe (XML procNFe completo), o `resumo` do parser pode
    // estar vazio. Extraímos os campos básicos diretamente do XML para que o
    // Portal Fiscal consiga exibir as colunas (Emissão, Emitente, Número, etc.)
    // e o tipo_documento seja registrado como 'procNFe' em vez do default
    // 'resNFe' (que faria a UI tratar como apenas resumo).
    const basicos = extrairCamposBasicosDoXml(xml);
    // Bloqueio: NF-e destinada a outro CNPJ não pode poluir o cache local.
    const mismatchErr = await validarDestinatarioPertenceCertificado(
      basicos.cnpjDestinatario,
      basicos.nomeDestinatario,
    );
    if (mismatchErr) {
      return {
        sucesso: false,
        origem: "sefaz",
        cStat: data.cStat,
        xMotivo: data.xMotivo,
        mensagemCstat: data.mensagemCstat ?? null,
        erro: mismatchErr,
      };
    }
    await supabase.from("nfe_distribuicao").upsert(
      {
        chave_acesso: chave,
        xml_nfe: xml,
        nsu: doc?.nsu ?? "0",
        tipo_documento: "procNFe",
        cnpj_emitente: doc?.resumo?.cnpjEmitente ?? basicos.cnpjEmitente ?? null,
        nome_emitente: doc?.resumo?.nomeEmitente ?? basicos.nomeEmitente ?? null,
        numero: doc?.resumo?.numero ?? basicos.numero ?? null,
        serie: doc?.resumo?.serie ?? basicos.serie ?? null,
        data_emissao: doc?.resumo?.dataEmissao ?? basicos.dataEmissao ?? null,
        valor_total: doc?.resumo?.valorTotal ?? basicos.valorTotal ?? null,
        uf_emitente: basicos.ufEmitente ?? null,
        cnpj_destinatario: basicos.cnpjDestinatario ?? null,
        nome_destinatario: basicos.nomeDestinatario ?? null,
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

/**
 * Extrai campos básicos de um XML procNFe/nfeProc para popular as colunas
 * de listagem em `nfe_distribuicao`. Tolera ordens diferentes dos elementos
 * e nodos repetidos (ex.: <CNPJ> em infRespTec e em emit) — para CNPJ/xNome
 * o emitente vem dentro de <emit>, então restringimos a esse bloco.
 */
function extrairCamposBasicosDoXml(xml: string): {
  cnpjEmitente?: string;
  nomeEmitente?: string;
  ufEmitente?: string;
  numero?: string;
  serie?: string;
  dataEmissao?: string;
  valorTotal?: number;
  cnpjDestinatario?: string;
  nomeDestinatario?: string;
} {
  if (!xml || typeof xml !== "string" || !xml.includes("<")) return {};
  const tag = (re: RegExp): string | undefined => re.exec(xml)?.[1]?.trim();
  const emit = /<emit\b[^>]*>([\s\S]*?)<\/emit>/i.exec(xml)?.[1] ?? "";
  const dest = /<dest\b[^>]*>([\s\S]*?)<\/dest>/i.exec(xml)?.[1] ?? "";
  const ide = /<ide\b[^>]*>([\s\S]*?)<\/ide>/i.exec(xml)?.[1] ?? "";
  const total = /<ICMSTot\b[^>]*>([\s\S]*?)<\/ICMSTot>/i.exec(xml)?.[1] ?? "";
  const inBlock = (block: string, t: string): string | undefined =>
    new RegExp(`<${t}[^>]*>([\\s\\S]*?)<\\/${t}>`, "i").exec(block)?.[1]?.trim();

  const cnpj = inBlock(emit, "CNPJ");
  const nome = inBlock(emit, "xNome");
  const uf = inBlock(emit, "UF");
  const numero = inBlock(ide, "nNF") ?? tag(/<nNF>([\s\S]*?)<\/nNF>/i);
  const serie = inBlock(ide, "serie") ?? tag(/<serie>([\s\S]*?)<\/serie>/i);
  const dhEmi = inBlock(ide, "dhEmi") ?? tag(/<dhEmi>([\s\S]*?)<\/dhEmi>/i);
  const vNF = inBlock(total, "vNF") ?? tag(/<vNF>([\s\S]*?)<\/vNF>/i);
  const vNum = vNF ? Number(vNF) : undefined;
  const cnpjDest = inBlock(dest, "CNPJ") ?? inBlock(dest, "CPF");
  const nomeDest = inBlock(dest, "xNome");
  return {
    cnpjEmitente: cnpj || undefined,
    nomeEmitente: nome || undefined,
    ufEmitente: uf || undefined,
    numero: numero || undefined,
    serie: serie || undefined,
    dataEmissao: dhEmi || undefined,
    valorTotal: Number.isFinite(vNum) ? vNum : undefined,
    cnpjDestinatario: cnpjDest || undefined,
    nomeDestinatario: nomeDest || undefined,
  };
}

/**
 * Cacheia o XML em nfe_distribuicao (best-effort).
 * Retorna `{ ok: false, erro }` se o destinatário não pertence ao certificado
 * configurado — nesse caso o registro NÃO é gravado.
 */
async function cachearXmlPorChave(
  chave: string,
  xml: string,
): Promise<{ ok: boolean; erro?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const basicos = extrairCamposBasicosDoXml(xml);
    const mismatchErr = await validarDestinatarioPertenceCertificado(
      basicos.cnpjDestinatario,
      basicos.nomeDestinatario,
    );
    if (mismatchErr) return { ok: false, erro: mismatchErr };
    await supabase.from("nfe_distribuicao").upsert(
      {
        chave_acesso: chave,
        xml_nfe: xml,
        nsu: "0",
        tipo_documento: "procNFe",
        cnpj_emitente: basicos.cnpjEmitente ?? null,
        nome_emitente: basicos.nomeEmitente ?? null,
        uf_emitente: basicos.ufEmitente ?? null,
        numero: basicos.numero ?? null,
        serie: basicos.serie ?? null,
        data_emissao: basicos.dataEmissao ?? null,
        valor_total: basicos.valorTotal ?? null,
        cnpj_destinatario: basicos.cnpjDestinatario ?? null,
        nome_destinatario: basicos.nomeDestinatario ?? null,
        status_manifestacao: "sem_manifestacao",
        usuario_id: user?.id ?? null,
      },
      { onConflict: "chave_acesso", ignoreDuplicates: false },
    );
    return { ok: true };
  } catch {
    return { ok: true }; // best-effort: erros de transporte não bloqueiam
  }
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
          const cached = await cachearXmlPorChave(chave, xml);
          if (!cached.ok) {
            return { sucesso: false, origem: "api", erro: cached.erro };
          }
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
      const cached = await cachearXmlPorChave(chave, sefaz.xml);
      if (!cached.ok) {
        return { sucesso: false, origem: "sefaz", erro: cached.erro };
      }
      return { sucesso: true, origem: "sefaz", xml: sefaz.xml };
    }
    // Propaga mismatch detectado dentro de consultarNFePorChave.
    if (!sefaz.sucesso && sefaz.erro?.startsWith(DEST_MISMATCH_PREFIX)) {
      return { sucesso: false, origem: "sefaz", erro: sefaz.erro };
    }
  } catch { /* ignora — mantém erro do consultadanfe */ }

  return { sucesso: false, origem: "api", erro: erroConsultaDanfe };
}

// Busca retroativa via `consNFeDest` (NFeConsultaDest) foi REMOVIDA em jun/2026.
// O endpoint foi descontinuado pela SEFAZ em 2017 e retorna SOAP vazio. A via
// oficial atual é DistDFe (sincronizarDistDFe) + consChNFe (consultarNFePorChave).
// Ver mem/features/fiscal-consulta-por-chave.md.