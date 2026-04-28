/**
 * Dashboard Fiscal — KPIs cruzados (Onda 18).
 *
 * Carrega em uma única chamada paralela todos os números do painel:
 *  - NF-e emitidas (saída) por status no período
 *  - NF-e de entrada (DistDF-e) por status_manifestacao no período
 *  - Apuração de tributos (ICMS/IPI/PIS/COFINS) do período (somente saídas autorizadas)
 *  - Eventos pendentes (rejeições, sem manifestação)
 *  - Sincronização DistDF-e (última execução do cron)
 *  - Próxima numeração e modo de emissão da empresa
 *
 * Performance: usa COUNT(*) head:true onde possível (sem trafegar linhas).
 */

import { supabase } from "@/integrations/supabase/client";

export interface DashboardFiscalKpis {
  saida: {
    autorizadas: number;
    rejeitadas: number;
    canceladas: number;
    pendentes: number;
    valorAutorizado: number;
  };
  entrada: {
    total: number;
    semManifestacao: number;
    cienciaConfirmada: number;
    desconhecidaNaoRealizada: number;
    valorTotal: number;
  };
  tributos: {
    icms: number;
    ipi: number;
    pis: number;
    cofins: number;
    icmsSt: number;
  };
  sincronizacao: {
    ultimaSyncAt: string | null;
    ultimoCStat: string | null;
    qtdCnpjs: number;
  };
  empresa: {
    proximoNumero: number | null;
    serie: string | null;
    modoEmissao: string | null;
    contingenciaAtiva: boolean;
    ambiente: "1" | "2";
  };
  serieDiaria: Array<{ dia: string; emitidas: number; recebidas: number }>;
}

export interface PeriodoFiscal {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

function sumNumeric<T extends Record<string, unknown>>(rows: T[], key: keyof T): number {
  return rows.reduce((s, r) => s + Number((r as Record<string, unknown>)[key as string] ?? 0), 0);
}

export async function fetchDashboardFiscal(periodo: PeriodoFiscal): Promise<DashboardFiscalKpis> {
  const { from, to } = periodo;

  const [
    saidaAut,
    saidaRej,
    saidaCanc,
    saidaPend,
    saidaValores,
    entradaRows,
    syncRow,
    cfgRow,
  ] = await Promise.all([
    supabase.from("notas_fiscais").select("*", { count: "exact", head: true })
      .eq("ativo", true).eq("tipo_operacao", "saida")
      .in("status", ["autorizada"]).gte("data_emissao", from).lte("data_emissao", to),
    supabase.from("notas_fiscais").select("*", { count: "exact", head: true })
      .eq("ativo", true).eq("tipo_operacao", "saida")
      .eq("status", "rejeitada").gte("data_emissao", from).lte("data_emissao", to),
    supabase.from("notas_fiscais").select("*", { count: "exact", head: true })
      .eq("ativo", true).eq("tipo_operacao", "saida")
      .eq("status", "cancelada").gte("data_emissao", from).lte("data_emissao", to),
    supabase.from("notas_fiscais").select("*", { count: "exact", head: true })
      .eq("ativo", true).eq("tipo_operacao", "saida")
      .in("status", ["pendente", "em_processamento", "rascunho"])
      .gte("data_emissao", from).lte("data_emissao", to),
    supabase.from("notas_fiscais")
      .select("data_emissao, valor_total, icms_valor, ipi_valor, pis_valor, cofins_valor, icms_st_valor")
      .eq("ativo", true).eq("tipo_operacao", "saida").eq("status", "autorizada")
      .gte("data_emissao", from).lte("data_emissao", to),
    supabase.from("nfe_distribuicao")
      .select("status_manifestacao, valor_total, data_emissao")
      .gte("data_emissao", from).lte("data_emissao", `${to}T23:59:59`),
    supabase.from("nfe_distdfe_sync")
      .select("ultima_sync_at, ultima_resposta_cstat, cnpj")
      .order("ultima_sync_at", { ascending: false }),
    supabase.from("empresa_config")
      .select("proximo_numero_nfe, serie_padrao_nfe, modo_emissao_nfe, contingencia_inicio, ambiente_sefaz, ambiente_padrao")
      .limit(1).maybeSingle(),
  ]);

  const valoresSaida = saidaValores.data ?? [];
  const entradas = entradaRows.data ?? [];

  // KPIs entrada
  const entrada = {
    total: entradas.length,
    semManifestacao: entradas.filter((e) => e.status_manifestacao === "sem_manifestacao").length,
    cienciaConfirmada: entradas.filter((e) =>
      e.status_manifestacao === "ciencia" || e.status_manifestacao === "confirmada"
    ).length,
    desconhecidaNaoRealizada: entradas.filter((e) =>
      e.status_manifestacao === "desconhecida" || e.status_manifestacao === "nao_realizada"
    ).length,
    valorTotal: sumNumeric(entradas as Record<string, unknown>[], "valor_total"),
  };

  // Série diária (emitidas vs recebidas)
  const mapDias = new Map<string, { emitidas: number; recebidas: number }>();
  const inc = (key: string, field: "emitidas" | "recebidas") => {
    const cur = mapDias.get(key) ?? { emitidas: 0, recebidas: 0 };
    cur[field]++;
    mapDias.set(key, cur);
  };
  for (const v of valoresSaida) {
    if (v.data_emissao) inc(String(v.data_emissao).slice(0, 10), "emitidas");
  }
  for (const e of entradas) {
    if (e.data_emissao) inc(String(e.data_emissao).slice(0, 10), "recebidas");
  }
  const serieDiaria = Array.from(mapDias.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, v]) => ({ dia, ...v }));

  // Empresa
  const cfg = cfgRow.data;
  let ambiente: "1" | "2" = "2";
  if (cfg?.ambiente_sefaz === "1" || cfg?.ambiente_sefaz === "2") ambiente = cfg.ambiente_sefaz;
  else if (cfg?.ambiente_padrao === "producao") ambiente = "1";

  const cnpjsSet = new Set((syncRow.data ?? []).map((r) => r.cnpj));
  const ultimaSync = syncRow.data?.[0] ?? null;

  return {
    saida: {
      autorizadas: saidaAut.count ?? 0,
      rejeitadas: saidaRej.count ?? 0,
      canceladas: saidaCanc.count ?? 0,
      pendentes: saidaPend.count ?? 0,
      valorAutorizado: sumNumeric(valoresSaida as Record<string, unknown>[], "valor_total"),
    },
    entrada,
    tributos: {
      icms: sumNumeric(valoresSaida as Record<string, unknown>[], "icms_valor"),
      ipi: sumNumeric(valoresSaida as Record<string, unknown>[], "ipi_valor"),
      pis: sumNumeric(valoresSaida as Record<string, unknown>[], "pis_valor"),
      cofins: sumNumeric(valoresSaida as Record<string, unknown>[], "cofins_valor"),
      icmsSt: sumNumeric(valoresSaida as Record<string, unknown>[], "icms_st_valor"),
    },
    sincronizacao: {
      ultimaSyncAt: ultimaSync?.ultima_sync_at ?? null,
      ultimoCStat: ultimaSync?.ultima_resposta_cstat ?? null,
      qtdCnpjs: cnpjsSet.size,
    },
    empresa: {
      proximoNumero: cfg?.proximo_numero_nfe ?? null,
      serie: cfg?.serie_padrao_nfe ?? null,
      modoEmissao: cfg?.modo_emissao_nfe ?? null,
      contingenciaAtiva: !!cfg?.contingencia_inicio,
      ambiente,
    },
    serieDiaria,
  };
}