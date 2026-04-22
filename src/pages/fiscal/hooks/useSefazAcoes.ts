import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getUserFriendlyError } from "@/utils/errorMessages";
import {
  autorizarNFe,
  consultarNFe,
  cancelarNFe,
  resolverUrlSefaz,
  type AmbienteSefaz,
  type AutorizacaoResult,
  type CancelamentoResult,
  type ConsultaResult,
  type NFeData,
} from "@/services/fiscal/sefaz";
import {
  cancelarNotaFiscalSefaz,
  registrarEventoFiscal,
} from "@/services/fiscal.service";
import type { NotaFiscal } from "@/types/domain";

/**
 * Hook orquestrador das ações SEFAZ usadas na UI Fiscal.
 *
 * Centraliza:
 *  - leitura de UF/ambiente da empresa (`empresa_config`)
 *  - resolução de endpoints (`resolverUrlSefaz`)
 *  - chamada do sefaz-proxy (modo Vault: certificado/senha server-side)
 *  - persistência do retorno em `notas_fiscais` (status, protocolo, motivo)
 *  - registro de eventos fiscais para a timeline
 *  - feedback ao usuário (toasts) e estado `pending`/`ultimoRetorno`
 */

interface SefazRetornoUI {
  protocolo?: string;
  status?: string;
  motivo?: string;
  xmlRetorno?: string;
  erros?: string[];
}

interface ConfigEmpresa {
  uf: string;
  ambiente: AmbienteSefaz;
  cnpj: string;
}

async function lerConfigEmpresa(): Promise<ConfigEmpresa> {
  const { data, error } = await supabase
    .from("empresa_config")
    .select("uf, ambiente_sefaz, ambiente_padrao, cnpj")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.uf) {
    throw new Error(
      "UF da empresa não configurada. Acesse Configuração Fiscal e informe a UF emitente.",
    );
  }
  if (!data.cnpj) {
    throw new Error("CNPJ da empresa não configurado em Configuração Fiscal.");
  }
  let ambiente: AmbienteSefaz = "2";
  if (data.ambiente_sefaz === "1" || data.ambiente_sefaz === "2") {
    ambiente = data.ambiente_sefaz;
  } else if (data.ambiente_padrao === "producao") {
    ambiente = "1";
  }
  return { uf: data.uf.toUpperCase(), ambiente, cnpj: data.cnpj };
}

export interface UseSefazAcoesReturn {
  pending: boolean;
  ultimoRetorno: SefazRetornoUI | null;
  modalAberto: boolean;
  fecharModal: () => void;
  transmitir: (nf: NotaFiscal, dadosNFe: NFeData) => Promise<AutorizacaoResult | null>;
  consultar: (nf: NotaFiscal) => Promise<ConsultaResult | null>;
  cancelar: (nf: NotaFiscal, justificativa: string) => Promise<CancelamentoResult | null>;
}

export function useSefazAcoes(): UseSefazAcoesReturn {
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);
  const [ultimoRetorno, setUltimoRetorno] = useState<SefazRetornoUI | null>(null);
  const [modalAberto, setModalAberto] = useState(false);

  const fecharModal = useCallback(() => setModalAberto(false), []);

  const transmitir = useCallback<UseSefazAcoesReturn["transmitir"]>(
    async (nf, dadosNFe) => {
      if (nf.status_sefaz === "autorizada") {
        toast.error("NF já autorizada pela SEFAZ.");
        return null;
      }
      setPending(true);
      try {
        const cfg = await lerConfigEmpresa();
        const url = resolverUrlSefaz(cfg.uf, cfg.ambiente, "autorizacao");
        const result = await autorizarNFe(
          { ...dadosNFe, ambiente: cfg.ambiente },
          { tipo: "A1", conteudo: "", senha: "" },
          url,
        );
        const proxima_status = result.sucesso ? "autorizada" : "rejeitada";
        await supabase
          .from("notas_fiscais")
          .update({
            status_sefaz: proxima_status,
            protocolo_autorizacao: result.protocolo ?? null,
            chave_acesso: result.chave ?? nf.chave_acesso,
            motivo_rejeicao: result.sucesso ? null : (result.motivo ?? null),
            ambiente_emissao: cfg.ambiente === "1" ? "producao" : "homologacao",
          })
          .eq("id", nf.id);
        await registrarEventoFiscal({
          nota_fiscal_id: nf.id,
          tipo_evento: result.sucesso ? "autorizacao" : "rejeicao",
          status_anterior: nf.status_sefaz ?? "nao_enviada",
          status_novo: proxima_status,
          descricao: result.motivo ?? undefined,
          payload_resumido: { protocolo: result.protocolo, status: result.status },
        });
        setUltimoRetorno({
          protocolo: result.protocolo,
          status: result.status,
          motivo: result.motivo,
          xmlRetorno: result.xmlAutorizado,
        });
        setModalAberto(true);
        if (result.sucesso) toast.success(`NF autorizada — protocolo ${result.protocolo}`);
        else toast.error(`SEFAZ rejeitou: ${result.motivo ?? "motivo desconhecido"}`);
        qc.invalidateQueries({ queryKey: ["notas_fiscais"] });
        return result;
      } catch (e) {
        toast.error(getUserFriendlyError(e));
        return null;
      } finally {
        setPending(false);
      }
    },
    [qc],
  );

  const consultar = useCallback<UseSefazAcoesReturn["consultar"]>(
    async (nf) => {
      if (!nf.chave_acesso) {
        toast.error("Esta NF não possui chave de acesso para consulta.");
        return null;
      }
      setPending(true);
      try {
        const cfg = await lerConfigEmpresa();
        const url = resolverUrlSefaz(cfg.uf, cfg.ambiente, "consulta");
        const result = await consultarNFe(
          nf.chave_acesso,
          { tipo: "A1", conteudo: "", senha: "" },
          url,
        );
        setUltimoRetorno({
          protocolo: result.protocolo,
          status: result.status,
          motivo: result.motivo,
        });
        setModalAberto(true);
        if (result.sucesso) toast.success(`SEFAZ respondeu: ${result.motivo ?? result.status}`);
        else toast.error(`Consulta falhou: ${result.motivo ?? "—"}`);
        return result;
      } catch (e) {
        toast.error(getUserFriendlyError(e));
        return null;
      } finally {
        setPending(false);
      }
    },
    [],
  );

  const cancelar = useCallback<UseSefazAcoesReturn["cancelar"]>(
    async (nf, justificativa) => {
      if (nf.status_sefaz !== "autorizada") {
        toast.error("Apenas NFs autorizadas podem ser canceladas via SEFAZ.");
        return null;
      }
      if (!nf.chave_acesso || !nf.protocolo_autorizacao) {
        toast.error("NF sem chave/protocolo de autorização — não é possível cancelar.");
        return null;
      }
      if (justificativa.trim().length < 15) {
        toast.error("Justificativa de cancelamento exige no mínimo 15 caracteres.");
        return null;
      }
      setPending(true);
      try {
        const cfg = await lerConfigEmpresa();
        const url = resolverUrlSefaz(cfg.uf, cfg.ambiente, "evento");
        const result = await cancelarNFe(
          nf.chave_acesso,
          nf.protocolo_autorizacao,
          justificativa,
          { tipo: "A1", conteudo: "", senha: "" },
          url,
          { cnpj: cfg.cnpj },
          cfg.ambiente,
        );
        if (result.sucesso && result.protocolo) {
          await cancelarNotaFiscalSefaz(nf.id, result.protocolo, justificativa);
        }
        await registrarEventoFiscal({
          nota_fiscal_id: nf.id,
          tipo_evento: "cancelamento_autorizada",
          status_anterior: nf.status_sefaz ?? null,
          status_novo: result.sucesso ? "cancelada_sefaz" : nf.status_sefaz ?? null,
          descricao: justificativa,
          payload_resumido: {
            protocolo_cancelamento: result.protocolo,
            motivo: result.motivo,
          },
        });
        setUltimoRetorno({
          protocolo: result.protocolo,
          status: result.sucesso ? "135" : undefined,
          motivo: result.motivo,
        });
        setModalAberto(true);
        if (result.sucesso) toast.success("Cancelamento homologado pela SEFAZ.");
        else toast.error(`Cancelamento rejeitado: ${result.motivo ?? "—"}`);
        qc.invalidateQueries({ queryKey: ["notas_fiscais"] });
        return result;
      } catch (e) {
        toast.error(getUserFriendlyError(e));
        return null;
      } finally {
        setPending(false);
      }
    },
    [qc],
  );

  return {
    pending,
    ultimoRetorno,
    modalAberto,
    fecharModal,
    transmitir,
    consultar,
    cancelar,
  };
}