import type { NfseData } from "@/lib/fiscal/nfseXmlParser";

export interface NfseProviderContext {
  cnpjEmpresa: string;
  ambiente?: "producao" | "homologacao";
}

export interface NfseProviderStatus {
  id: string;
  enabled: boolean;
  configured: boolean;
  modo: "importacao" | "consulta" | "ambos";
  motivo?: string;
}

export interface NfseProvider {
  readonly id: string;
  readonly label: string;
  status(): Promise<NfseProviderStatus>;
  suportaXml(xml: string): boolean;
  interpretarXml(xml: string): NfseData;
  /** Consulta externa é opcional; providers sem integração podem trabalhar somente por XML. */
  consultarDocumento?(identificador: string, contexto: NfseProviderContext): Promise<string | null>;
}
