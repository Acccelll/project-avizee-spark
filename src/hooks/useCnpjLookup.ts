import { useState } from "react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface CnpjResult {
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  email: string;
  telefone: string;
  inscricao_estadual: string;
}

/** Tenta BrasilAPI primeiro; se falhar/404/timeout, cai para open.cnpja.com. */
async function fetchCnpjWithFallback(cnpj: string): Promise<any | null> {
  const controllers = [new AbortController(), new AbortController()];
  const timeout = (c: AbortController, ms = 8000) => setTimeout(() => c.abort(), ms);

  // 1) BrasilAPI
  try {
    const t = timeout(controllers[0]);
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      signal: controllers[0].signal,
    });
    clearTimeout(t);
    if (res.ok) return { source: "brasilapi", data: await res.json() };
    if (res.status === 404) return { notFound: true };
  } catch (err) {
    logger.warn("[cnpj-lookup] brasilapi falhou, tentando fallback", err);
  }

  // 2) open.cnpja.com (público, CORS liberado)
  try {
    const t = timeout(controllers[1]);
    const res = await fetch(`https://open.cnpja.com/office/${cnpj}`, {
      signal: controllers[1].signal,
    });
    clearTimeout(t);
    if (res.ok) return { source: "cnpja", data: await res.json() };
    if (res.status === 404) return { notFound: true };
  } catch (err) {
    logger.error("[cnpj-lookup] fallback cnpja falhou", err);
  }

  return null;
}

function normalizeCnpjaPayload(raw: any) {
  // open.cnpja.com retorna estrutura diferente de BrasilAPI — normalizamos
  // para o mesmo shape usado a seguir.
  const addr = raw?.address ?? {};
  const phones: Array<{ area: string; number: string }> = raw?.phones ?? [];
  const p = phones[0];
  const ddd_telefone_1 = p ? `${p.area}${p.number}` : "";
  const ie = raw?.registrations?.find((r: any) => r?.enabled)?.number ?? "";
  return {
    razao_social: raw?.company?.name ?? "",
    nome_fantasia: raw?.alias ?? "",
    logradouro: addr.street ?? "",
    numero: addr.number ?? "",
    complemento: addr.details ?? "",
    bairro: addr.district ?? "",
    municipio: addr.city ?? "",
    uf: addr.state ?? "",
    cep: addr.zip ?? "",
    email: raw?.emails?.[0]?.address ?? "",
    ddd_telefone_1,
    inscricoes_estaduais: ie ? [{ inscricao_estadual: ie, ativo: true }] : [],
  };
}

export function useCnpjLookup() {
  const [loading, setLoading] = useState(false);

  const buscarCnpj = async (cnpj: string): Promise<CnpjResult | null> => {
    const cleanCnpj = cnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) return null;

    setLoading(true);
    try {
      const result = await fetchCnpjWithFallback(cleanCnpj);
      if (!result) {
        toast.error("Erro ao consultar CNPJ. Verifique sua conexão e tente novamente.");
        return null;
      }
      if (result.notFound) {
        toast.error("CNPJ não encontrado na base da Receita Federal");
        return null;
      }
      const data = result.source === "cnpja" ? normalizeCnpjaPayload(result.data) : result.data;

      const telefone = data.ddd_telefone_1
        ? `(${data.ddd_telefone_1.substring(0, 2)}) ${data.ddd_telefone_1.substring(2)}`
        : "";

      // Try to get Inscrição Estadual from the QSA/registration data
      // BrasilAPI doesn't always return IE directly, but we extract it when available
      let inscricaoEstadual = "";
      if (data.inscricoes_estaduais && Array.isArray(data.inscricoes_estaduais)) {
        const ieAtiva = data.inscricoes_estaduais.find(
          (ie: any) => ie.ativo === true || ie.situacao_cadastral === "ATIVA"
        );
        if (ieAtiva) inscricaoEstadual = ieAtiva.inscricao_estadual || "";
      }

      toast.success("Dados do CNPJ preenchidos automaticamente!");

      return {
        razao_social: data.razao_social || "",
        nome_fantasia: data.nome_fantasia || "",
        cnpj: cleanCnpj,
        logradouro: data.logradouro || "",
        numero: data.numero || "",
        complemento: data.complemento || "",
        bairro: data.bairro || "",
        municipio: data.municipio || "",
        uf: data.uf || "",
        cep: data.cep ? data.cep.replace(/\D/g, "") : "",
        email: data.email || "",
        telefone,
        inscricao_estadual: inscricaoEstadual,
      };
    } catch (err) {
      logger.error("[cnpj-lookup] erro inesperado", err);
      toast.error("Erro de conexão ao consultar CNPJ");
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { buscarCnpj, loading };
}
