import { isNfseXml, parseNfseXml } from "@/lib/fiscal/nfseXmlParser";
import type { NfseProvider, NfseProviderStatus } from "./provider";

/**
 * Adapter do padrão nacional. Nesta entrega ele é fonte de interpretação XML.
 * Consulta ao ADN permanece fail-closed até configuração explícita da integração.
 */
export class NationalNfseProvider implements NfseProvider {
  readonly id = "nfse-nacional";
  readonly label = "NFS-e Padrão Nacional / ADN";

  async status(): Promise<NfseProviderStatus> {
    const enabled = import.meta.env.VITE_NFSE_ADN_ENABLED === "true";
    const configured = enabled && !!import.meta.env.VITE_NFSE_ADN_ENDPOINT;
    return {
      id: this.id,
      enabled,
      configured,
      modo: configured ? "ambos" : "importacao",
      motivo: configured ? undefined : "Consulta ADN desativada até endpoint/credenciais serem homologados.",
    };
  }

  suportaXml(xml: string): boolean { return isNfseXml(xml); }
  interpretarXml(xml: string) { return parseNfseXml(xml); }

  async consultarDocumento(): Promise<string | null> {
    const st = await this.status();
    if (!st.configured) return null;
    // Contrato deliberadamente fail-closed: a chamada real deve entrar apenas após
    // homologação do mecanismo oficial de autenticação do ADN no ambiente da empresa.
    throw new Error("Consulta ADN ainda não homologada para execução automática.");
  }
}

export const nationalNfseProvider = new NationalNfseProvider();
