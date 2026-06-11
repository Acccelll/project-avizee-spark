// deno-lint-ignore-file no-explicit-any
/**
 * Edge Function: process-distdfe-cron
 *
 * Cron diário (executado por pg_cron) que dispara a sincronização DistDF-e
 * para todos os CNPJs cadastrados em `nfe_distdfe_sync`. Para cada CNPJ,
 * invoca internamente a edge function `sefaz-distdfe` (action: consultar-nsu)
 * e persiste os documentos retornados em `nfe_distribuicao`. Resultados
 * (totais, erros, cStat) são gravados em `audit_logs` para rastreabilidade.
 *
 * Segurança: aceita apenas chamadas com `Authorization: Bearer <ANON_KEY>`
 * vindas do pg_cron (ou execução manual via supabase.functions.invoke por
 * um admin). Não exige sessão de usuário; usa SERVICE_ROLE para escrita
 * em `audit_logs` e leitura de `nfe_distdfe_sync`.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { recordCronHealth } from "../_shared/cron-health.ts";
import { createLogger } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface DistDFeDoc {
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

interface DistDFeResponse {
  sucesso: boolean;
  cnpj?: string;
  ambiente?: "1" | "2";
  cStat?: string;
  xMotivo?: string;
  ultNSU?: string;
  maxNSU?: string;
  docs?: DistDFeDoc[];
  erro?: string;
}

// ── Helper: URL do AN por ambiente ───────────────────────────────
function urlAnRecepcaoEvento(ambiente: "1" | "2"): string {
  return ambiente === "1"
    ? "https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx"
    : "https://hom.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx";
}
const SOAP_ACTION_EVENTO =
  "http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento";

// ── Helper: XML de Ciência da Operação (evento 210210) ───────────
function xmlCiencia(
  chave: string,
  cnpj: string,
  ambiente: "1" | "2",
  dhEvento: string,
): string {
  const cnpjLimpo = cnpj.replace(/\D/g, "");
  return (
    `<envEvento versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe">` +
    `<idLote>1</idLote>` +
    `<evento versao="1.00">` +
    `<infEvento Id="ID210210${chave}01">` +
    `<cOrgao>91</cOrgao>` +
    `<tpAmb>${ambiente}</tpAmb>` +
    `<CNPJ>${cnpjLimpo}</CNPJ>` +
    `<chNFe>${chave}</chNFe>` +
    `<dhEvento>${dhEvento}</dhEvento>` +
    `<tpEvento>210210</tpEvento>` +
    `<nSeqEvento>1</nSeqEvento>` +
    `<verEvento>1.00</verEvento>` +
    `<detEvento versao="1.00">` +
    `<descEvento>Ciencia da Operacao</descEvento>` +
    `</detEvento>` +
    `</infEvento>` +
    `</evento>` +
    `</envEvento>`
  );
}

// ── Helper: envia Ciência via sefaz-proxy (server-side) ──────────
async function enviarCienciaServerSide(
  chave: string,
  cnpj: string,
  ambiente: "1" | "2",
  supabaseUrl: string,
  serviceRoleKey: string,
  anonKey: string,
): Promise<{ sucesso: boolean; protocolo?: string; cStat?: string; motivo?: string }> {
  // Horário de Brasília (UTC-3 fixo — BR não tem horário de verão desde 2019).
  // toISOString() devolve UTC; subtraímos 3h para que o instante representado
  // por "<hora>-03:00" seja o agora real, e não 3h no futuro (rejeição 578).
  const dhEvento = new Date(Date.now() - 3 * 60 * 60 * 1000)
    .toISOString()
    .replace(/\.\d+Z$/, "-03:00");
  const xml = xmlCiencia(chave, cnpj, ambiente, dhEvento);
  const url = urlAnRecepcaoEvento(ambiente);

  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/sefaz-proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": anonKey,
      },
      body: JSON.stringify({
        action: "assinar-e-enviar-vault",
        xml,
        url,
        soapAction: SOAP_ACTION_EVENTO,
      }),
    });
    const data = await resp.json() as { sucesso: boolean; xmlRetorno?: string; erro?: string };
    if (!data.sucesso) {
      return { sucesso: false, motivo: data.erro ?? "Falha ao enviar Ciência" };
    }
    const xmlRet = data.xmlRetorno ?? "";
    const cStat = xmlRet.match(/<cStat>(\d+)<\/cStat>/)?.[1];
    const protocolo = xmlRet.match(/<nProt>(\d+)<\/nProt>/)?.[1];
    const xMotivo = xmlRet.match(/<xMotivo>([^<]+)<\/xMotivo>/)?.[1];
    const sucesso = cStat === "135" || cStat === "136";
    return { sucesso, protocolo, cStat, motivo: xMotivo };
  } catch (e) {
    return { sucesso: false, motivo: (e as Error).message };
  }
}

// ── Helper: baixa XML completo via consultar-chave (DistDFe) ─────
async function baixarXmlCompletoChave(
  chave: string,
  ambiente: "1" | "2",
  supabaseUrl: string,
  serviceRoleKey: string,
  anonKey: string,
): Promise<string | null> {
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/sefaz-distdfe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": anonKey,
      },
      body: JSON.stringify({ action: "consultar-chave", chNFe: chave, ambiente }),
    });
    const data = await resp.json() as {
      sucesso: boolean;
      docs?: Array<{ xml: string; schema: string }>;
      erro?: string;
    };
    if (!data.sucesso || !data.docs?.length) return null;
    const completo = data.docs.find((d) => d.schema.startsWith("procNFe"));
    return completo?.xml ?? data.docs[0]?.xml ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const log = createLogger("process-distdfe-cron");

  // Sprint 7.1 P0 — gate de invocação anônima.
  // verify_jwt=false (necessário para o pg_cron chamar via net.http_post sem
  // sessão), portanto a função fica exposta. Exigimos um secret compartilhado
  // CRON_SECRET que o pg_cron envia via header X-Cron-Secret (ou query
  // ?cron_secret=). Quando o secret NÃO está configurado no projeto, mantemos
  // o comportamento antigo (open) para não quebrar deployments legados, mas
  // logamos um WARN bem visível para o operador atualizar.
  const expectedSecret = Deno.env.get("CRON_SECRET")?.trim();
  if (expectedSecret) {
    const url = new URL(req.url);
    const provided =
      req.headers.get("x-cron-secret")?.trim() ||
      url.searchParams.get("cron_secret")?.trim() ||
      "";
    if (provided !== expectedSecret) {
      log.info("invocação rejeitada: cron secret inválido/ausente", {
        hasHeader: !!req.headers.get("x-cron-secret"),
        hasQuery: !!url.searchParams.get("cron_secret"),
      });
      return json({ sucesso: false, erro: "Unauthorized: cron secret inválido." }, 401);
    }
  } else {
    log.info("CRON_SECRET não configurado — execução aberta (configure o secret e atualize o pg_cron)");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Ambiente: prioridade body > empresa_config.ambiente_sefaz > "2" (homolog).
  // Antes o default era homologação fixa, o que silenciosamente perdia DistDF-e
  // em produção. Agora consultamos a configuração da empresa principal.
  let ambiente: "1" | "2" = "2";
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.ambiente === "1" || body?.ambiente === "2") {
      ambiente = body.ambiente;
    } else {
      const { data: cfg } = await admin
        .from("empresa_config")
        .select("ambiente_sefaz, ambiente_padrao")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      const cfgAmb = (cfg as { ambiente_sefaz?: string | number; ambiente_padrao?: string } | null);
      if (cfgAmb) {
        if (cfgAmb.ambiente_sefaz === "1" || cfgAmb.ambiente_sefaz === 1 || cfgAmb.ambiente_padrao === "producao") {
          ambiente = "1";
        } else if (cfgAmb.ambiente_sefaz === "2" || cfgAmb.ambiente_sefaz === 2 || cfgAmb.ambiente_padrao === "homologacao") {
          ambiente = "2";
        }
      }
    }
  } catch {
    // sem body / sem config — mantém default conservador
  }
  log.info("Ambiente DistDF-e resolvido", { ambiente });

  const inicio = new Date().toISOString();
  const inicioMs = Date.now();
  const resultados: Array<{
    cnpj: string;
    sucesso: boolean;
    novos: number;
    duplicados: number;
    cStat?: string;
    xMotivo?: string;
    erro?: string;
  }> = [];

  // Sprint 7.4 #17 — Circuit breaker para cStat=656 (consumo indevido).
  // Quando o AN devolve 656, o CNPJ fica bloqueado por ~1h. Persistimos
  // `distdfe_circuit_break_until` em `app_configuracoes` e abortamos a execução
  // até o vencimento, evitando reentrar no bloqueio.
  const CIRCUIT_KEY = `distdfe_circuit_break_until_${ambiente}`;
  try {
    const { data: cb } = await admin
      .from("app_configuracoes")
      .select("valor")
      .eq("chave", CIRCUIT_KEY)
      .maybeSingle();
    const until = (cb?.valor as { until?: string } | null)?.until;
    if (until && new Date(until).getTime() > Date.now()) {
      log.info("circuit breaker ativo — pulando execução", { until, ambiente });
      return json({
        sucesso: true,
        skipped: true,
        motivo: "circuit_breaker_656",
        ate: until,
        ambiente,
      });
    }
  } catch (e) {
    log.info("falha ao ler circuit breaker (seguindo)", { erro: (e as Error).message });
  }

  // 1) Lista todos os CNPJs cadastrados para o ambiente
  const { data: syncs, error: syncErr } = await admin
    .from("nfe_distdfe_sync")
    .select("cnpj, ultimo_nsu")
    .eq("ambiente", ambiente);

  if (syncErr) {
    log.error("Erro ao listar nfe_distdfe_sync", { erro: syncErr.message });
    return json({ sucesso: false, erro: syncErr.message }, 500);
  }

  // Se não há nenhum CNPJ ainda (primeira execução), faz uma sondagem com
  // ultNSU=0 — a edge function descobre o CNPJ a partir do A1.
  const lista = syncs && syncs.length > 0
    ? syncs.map((s) => ({ cnpj: s.cnpj, ultNSU: s.ultimo_nsu ?? "0" }))
    : [{ cnpj: "auto", ultNSU: "0" }];

  for (const item of lista) {
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/sefaz-distdfe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Chamada interna sistema-para-sistema: usa SERVICE_ROLE para ser
          // reconhecida pela edge sefaz-distdfe como invocação privilegiada
          // (bypass do check de permissão de usuário). O secret nunca sai
          // do runtime das edge functions.
          "Authorization": `Bearer ${serviceRoleKey}`,
          "apikey": anonKey,
        },
        body: JSON.stringify({
          action: "consultar-nsu",
          ambiente,
          ultNSU: item.ultNSU,
        }),
      });
      const data = (await resp.json()) as DistDFeResponse;

      if (!data.sucesso) {
        resultados.push({
          cnpj: item.cnpj,
          sucesso: false,
          novos: 0,
          duplicados: 0,
          cStat: data.cStat,
          xMotivo: data.xMotivo,
          erro: data.erro ?? "Falha na consulta",
        });
        continue;
      }

      // Persiste documentos
      const docs = (data.docs ?? []).filter(
        (d) => d.chave && /^\d{44}$/.test(d.chave),
      );
      let novos = 0;
      let duplicados = 0;

      for (const d of docs) {
        const r = d.resumo ?? {};

        // Classifica o schema retornado pelo DistDFe.
        // procNFe = NF-e completa autorizada; resNFe = resumo (precisa Ciência);
        // resEvento/procEventoNFe = evento sobre NF-e existente (ex.: cancelamento).
        const schema = (d.schema ?? "").toLowerCase();
        let tipoDoc: "procNFe" | "resNFe" | "resEvento" | "procEventoNFe" = "resNFe";
        if (schema.includes("proceventonfe")) tipoDoc = "procEventoNFe";
        else if (schema.includes("resevento")) tipoDoc = "resEvento";
        else if (schema.includes("procnfe")) tipoDoc = "procNFe";
        else if (schema.includes("resnfe")) tipoDoc = "resNFe";

        // Eventos: tenta extrair tpEvento + protocolo do XML para detectar cancelamento.
        if (tipoDoc === "resEvento" || tipoDoc === "procEventoNFe") {
          const tpEvento = d.xml?.match(/<tpEvento>(\d+)<\/tpEvento>/)?.[1] ?? null;
          const nProt = d.xml?.match(/<nProt>([^<]+)<\/nProt>/)?.[1] ?? null;
          const dhEvento = d.xml?.match(/<dhEvento>([^<]+)<\/dhEvento>/)?.[1] ?? null;
          const xMotivo = d.xml?.match(/<xMotivo>([^<]+)<\/xMotivo>/)?.[1] ?? "";

          if (tpEvento === "110111") {
            // Cancelamento — atualiza o registro existente por chave_acesso
            await admin
              .from("nfe_distribuicao")
              .update({
                cancelamento_recebido_at: dhEvento ?? new Date().toISOString(),
                cancelamento_protocolo: nProt,
                observacao: `CANCELADA. Protocolo: ${nProt ?? "—"}. Motivo: ${xMotivo}`,
                data_processamento: new Date().toISOString(),
              })
              .eq("chave_acesso", d.chave!);
          }
          // Para qualquer evento, segue para próximo doc (não cria linha nova).
          continue;
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
          tipo_documento: tipoDoc,
          // procNFe traz a NF-e completa autorizada — guardamos o XML.
          xml_nfe: tipoDoc === "procNFe" ? d.xml ?? null : null,
          usuario_id: null,
        };
        const { error: upErr, data: upData } = await admin
          .from("nfe_distribuicao")
          .upsert(payload, { onConflict: "chave_acesso", ignoreDuplicates: false })
          .select("id, status_manifestacao")
          .maybeSingle();
        if (upErr) {
          if ((upErr as { code?: string }).code === "23505") duplicados++;
          continue;
        }
        if (upData) novos++;

        // Para resumos (resNFe) ainda sem manifestação, dispara Ciência
        // server-side (210210) e, se aceita, baixa o XML completo da chave.
        if (tipoDoc === "resNFe") {
          const statusAtual = (upData as { status_manifestacao?: string } | null)
            ?.status_manifestacao ?? "sem_manifestacao";
          const cnpjEmpresa = data.cnpj ?? "";
          if (statusAtual === "sem_manifestacao" && cnpjEmpresa) {
            const cienciaResult = await enviarCienciaServerSide(
              d.chave!,
              cnpjEmpresa,
              ambiente,
              supabaseUrl,
              serviceRoleKey,
              anonKey,
            );
            if (cienciaResult.sucesso) {
              await admin
                .from("nfe_distribuicao")
                .update({
                  // "ciencia" é o valor aceito pelo CHECK constraint.
                  // "ciencia_operacao" violava a constraint e causava falha silenciosa.
                  status_manifestacao: "ciencia",
                  data_manifestacao: new Date().toISOString(),
                  ciencia_automatica_at: new Date().toISOString(),
                  protocolo_autorizacao: cienciaResult.protocolo ?? null,
                })
                .eq("chave_acesso", d.chave!);

              const xmlCompleto = await baixarXmlCompletoChave(
                d.chave!,
                ambiente,
                supabaseUrl,
                serviceRoleKey,
                anonKey,
              );
              if (xmlCompleto) {
                await admin
                  .from("nfe_distribuicao")
                  .update({ xml_nfe: xmlCompleto })
                  .eq("chave_acesso", d.chave!);
              }
            } else {
              log.warn("Ciência automática falhou", {
                chave: d.chave,
                cStat: cienciaResult.cStat,
                motivo: cienciaResult.motivo,
              });
            }
          }
        }
      }

      // Atualiza nfe_distdfe_sync
      if (data.cnpj) {
        await admin.from("nfe_distdfe_sync").upsert(
          {
            cnpj: data.cnpj,
            ambiente,
            ultimo_nsu: data.ultNSU ?? item.ultNSU,
            max_nsu: data.maxNSU ?? null,
            ultima_sync_at: new Date().toISOString(),
            ultima_resposta_cstat: data.cStat ?? null,
            ultima_resposta_xmotivo: data.xMotivo ?? null,
            ultima_qtd_docs: docs.length,
          },
          { onConflict: "cnpj,ambiente" },
        );
      }

      resultados.push({
        cnpj: data.cnpj ?? item.cnpj,
        sucesso: true,
        novos,
        duplicados,
        cStat: data.cStat,
        xMotivo: data.xMotivo,
      });

      // Se AN devolveu cStat=656, ativa breaker por 65 minutos.
      if (data.cStat === "656") {
        const breakUntil = new Date(Date.now() + 65 * 60 * 1000).toISOString();
        await admin.from("app_configuracoes").upsert(
          {
            chave: CIRCUIT_KEY,
            valor: { until: breakUntil, motivo: data.xMotivo ?? "consumo indevido", cnpj: data.cnpj ?? item.cnpj },
          },
          { onConflict: "chave" },
        );
        log.info("circuit breaker armado (cStat=656)", { until: breakUntil });
        break;
      }
    } catch (e) {
      const err = e as Error;
      log.error("Erro ao sincronizar CNPJ", { cnpj: item.cnpj, erro: err.message });
      resultados.push({
        cnpj: item.cnpj,
        sucesso: false,
        novos: 0,
        duplicados: 0,
        erro: err.message,
      });
    }
  }

  const fim = new Date().toISOString();
  const totalNovos = resultados.reduce((s, r) => s + r.novos, 0);
  const totalDuplicados = resultados.reduce((s, r) => s + r.duplicados, 0);
  const totalErros = resultados.filter((r) => !r.sucesso).length;

  // Registra log em auditoria_logs
  await admin.from("auditoria_logs").insert({
    tabela: "nfe_distribuicao",
    acao: "distdfe_cron_run",
    registro_id: null,
    usuario_id: null,
    dados_novos: {
      ambiente,
      inicio,
      fim,
      total_cnpjs: resultados.length,
      total_novos: totalNovos,
      total_duplicados: totalDuplicados,
      total_erros: totalErros,
      detalhes: resultados,
    },
  });

  // Sprint 7.4 #19 — telemetria fiscal (uma linha por execução do cron + uma por CNPJ)
  try {
    await admin.from("fiscal_telemetria").insert({
      funcao: "process-distdfe-cron",
      action: "run",
      sucesso: totalErros === 0,
      latencia_ms: Date.now() - inicioMs,
      ambiente,
      detalhes: {
        total_cnpjs: resultados.length,
        total_novos: totalNovos,
        total_duplicados: totalDuplicados,
        total_erros: totalErros,
      },
    });
    if (resultados.length > 0) {
      await admin.from("fiscal_telemetria").insert(
        resultados.map((r) => ({
          funcao: "sefaz-distdfe",
          action: "consultar-nsu",
          sucesso: r.sucesso,
          ambiente,
          cnpj: r.cnpj,
          cstat: r.cStat ?? null,
          xmotivo: r.xMotivo ?? null,
          erro: r.erro ?? null,
          detalhes: { novos: r.novos, duplicados: r.duplicados },
        })),
      );
    }
  } catch (e) {
    log.info("telemetria fiscal falhou (seguindo)", { erro: (e as Error).message });
  }

  log.info("Sincronização DistDF-e concluída", {
    total_cnpjs: resultados.length,
    total_novos: totalNovos,
    total_erros: totalErros,
  });

  await recordCronHealth(
    admin,
    "process-distdfe-cron",
    totalErros > 0 ? "error" : "ok",
    totalErros > 0 ? `${totalErros} CNPJ(s) com erro` : undefined,
  );

  return json({
    sucesso: true,
    ambiente,
    inicio,
    fim,
    total_cnpjs: resultados.length,
    total_novos: totalNovos,
    total_duplicados: totalDuplicados,
    total_erros: totalErros,
    resultados,
  });
});
