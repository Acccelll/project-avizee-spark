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
  ultNSU?: string;
  maxNSU?: string;
  docs?: DistDFeDoc[];
  erro?: string;
}

/**
 * Consulta documentos novos a partir do último NSU sincronizado para o CNPJ.
 * Persiste resultados e devolve estatística da sincronização.
 */
export async function sincronizarDistDFe(
  ambiente: "1" | "2" = "2",
): Promise<{
  sucesso: boolean;
  novos: number;
  duplicados: number;
  ultNSU?: string;
  maxNSU?: string;
  cStat?: string;
  xMotivo?: string;
  erro?: string;
}> {
  // 1) Buscar CNPJ via edge function (que extrai do A1) — aqui usamos o
  //    valor armazenado em `nfe_distdfe_sync` se existir; senão começa em '0'
  //    e a edge function preenche o CNPJ.

  // Sondagem inicial: tenta obter um registro de sync existente (qualquer CNPJ);
  // a edge function retorna o CNPJ correto e atualizamos depois.
  const { data: syncs } = await supabase
    .from("nfe_distdfe_sync")
    .select("cnpj, ultimo_nsu")
    .eq("ambiente", ambiente)
    .limit(1);
  const ultNSU = syncs?.[0]?.ultimo_nsu ?? "0";

  // 2) Chama edge function
  const { data, error } = await supabase.functions.invoke<DistDFeResponse>(
    "sefaz-distdfe",
    { body: { action: "consultar-nsu", ambiente, ultNSU } },
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

  // 3) Persiste documentos (apenas os com chave de NF-e)
  const docs = (data.docs ?? []).filter((d) => d.chave && /^\d{44}$/.test(d.chave));
  let novos = 0;
  let duplicados = 0;
  const { data: { user } } = await supabase.auth.getUser();

  for (const d of docs) {
    const r = d.resumo ?? {};
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
        ambiente,
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