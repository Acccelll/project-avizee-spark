/**
 * Auto-Ciência DistDF-e — Onda 17.
 *
 * Quando a flag `app_configuracoes.distdfe_auto_ciencia=true` está ativa, o
 * `useAutoCienciaDistDFe` invoca este serviço para cada NF-e de entrada nova
 * (status_manifestacao='sem_manifestacao') registrando automaticamente o
 * evento NT 2012/002 código 210210 (Ciência da Operação) via Ambiente
 * Nacional.
 *
 * Reutiliza `enviarManifestacao` (já assina XMLDSig + envia via sefaz-proxy).
 * Persiste o evento em `eventos_fiscais` e atualiza `nfe_distribuicao`.
 * Idempotente: ignora notas que já tenham `status_manifestacao !=
 * 'sem_manifestacao'`.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  enviarManifestacao,
  statusManifestacaoFromEvento,
  tipoEventoFiscalFromManifestacao,
} from "./sefaz/manifestacao.service";
import type { AmbienteSefaz } from "./sefaz/xmlBuilder.service";

export interface AutoCienciaResultado {
  total: number;
  sucesso: number;
  falhas: number;
  detalhes: Array<{
    chave: string;
    sucesso: boolean;
    motivo?: string;
    protocolo?: string;
  }>;
}

export interface NfeEntradaAlvo {
  id: string;
  chave_acesso: string;
}

/**
 * Aplica ciência da operação (210210) em lote para as NF-e fornecidas.
 * - Carrega CNPJ destinatário e ambiente de `empresa_config` uma única vez.
 * - Faz uma checagem just-in-time do status atual de cada NF para evitar
 *   reprocessar notas já manifestadas por outro fluxo.
 */
export async function aplicarCienciaEmLote(
  notas: NfeEntradaAlvo[],
): Promise<AutoCienciaResultado> {
  const resultado: AutoCienciaResultado = {
    total: notas.length,
    sucesso: 0,
    falhas: 0,
    detalhes: [],
  };
  if (notas.length === 0) return resultado;

  const { data: cfg } = await supabase
    .from("empresa_config")
    .select("cnpj, ambiente_sefaz, ambiente_padrao")
    .limit(1)
    .maybeSingle();
  if (!cfg?.cnpj) {
    throw new Error("Configuração da empresa incompleta (CNPJ ausente).");
  }
  let ambiente: AmbienteSefaz = "2";
  if (cfg.ambiente_sefaz === "1" || cfg.ambiente_sefaz === "2") {
    ambiente = cfg.ambiente_sefaz;
  } else if (cfg.ambiente_padrao === "producao") {
    ambiente = "1";
  }

  const { data: { user } } = await supabase.auth.getUser();

  for (const nf of notas) {
    if (!/^\d{44}$/.test(nf.chave_acesso)) {
      resultado.falhas++;
      resultado.detalhes.push({
        chave: nf.chave_acesso,
        sucesso: false,
        motivo: "Chave de acesso inválida",
      });
      continue;
    }

    // Recheca status — outra aba/fluxo pode ter manifestado nesse intervalo.
    const { data: atual } = await supabase
      .from("nfe_distribuicao")
      .select("status_manifestacao")
      .eq("id", nf.id)
      .maybeSingle();
    if (atual && atual.status_manifestacao !== "sem_manifestacao") {
      continue;
    }

    try {
      const result = await enviarManifestacao(
        {
          chave: nf.chave_acesso,
          cnpjDestinatario: cfg.cnpj,
          tpEvento: "210210",
          ambiente,
        },
        { tipo: "A1", conteudo: "", senha: "" },
      );

      await supabase.from("eventos_fiscais").insert({
        nfe_distribuicao_id: nf.id,
        tipo_evento: tipoEventoFiscalFromManifestacao("210210"),
        codigo_evento: "210210",
        sequencia: 1,
        justificativa: null,
        protocolo: result.protocolo ?? null,
        data_evento: result.dataRetorno ?? new Date().toISOString(),
        status_sefaz: result.sucesso ? "autorizado" : "rejeitado",
        motivo_retorno: result.motivo ?? "auto-ciencia",
        xml_retorno: result.xmlRetorno ?? null,
        usuario_id: user?.id ?? null,
      });

      if (result.sucesso) {
        await supabase
          .from("nfe_distribuicao")
          .update({
            status_manifestacao: statusManifestacaoFromEvento("210210"),
            data_manifestacao: result.dataRetorno ?? new Date().toISOString(),
          })
          .eq("id", nf.id);
        resultado.sucesso++;
        resultado.detalhes.push({
          chave: nf.chave_acesso,
          sucesso: true,
          protocolo: result.protocolo,
        });
      } else {
        resultado.falhas++;
        resultado.detalhes.push({
          chave: nf.chave_acesso,
          sucesso: false,
          motivo: result.motivo,
        });
      }
    } catch (e) {
      const err = e as Error;
      resultado.falhas++;
      resultado.detalhes.push({
        chave: nf.chave_acesso,
        sucesso: false,
        motivo: err.message,
      });
    }
  }

  return resultado;
}

/** Carrega NF-e de entrada elegíveis para auto-ciência (sem manifestação). */
export async function buscarNfeSemManifestacao(
  limite = 50,
): Promise<NfeEntradaAlvo[]> {
  const { data, error } = await supabase
    .from("nfe_distribuicao")
    .select("id, chave_acesso")
    .eq("status_manifestacao", "sem_manifestacao")
    .order("created_at", { ascending: true })
    .limit(limite);
  if (error) throw error;
  return (data ?? []) as NfeEntradaAlvo[];
}