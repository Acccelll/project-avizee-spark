export {
  construirXMLNFe,
  construirXMLCancelamento,
  construirXMLInutilizacao,
  construirXMLCartaCorrecao,
} from "./xmlBuilder.service";
export type {
  NFeData,
  NFeItemData,
  NFeTotaisData,
  NFePagamentoData,
} from "./xmlBuilder.service";

export type { CertificadoDigital, AssinaturaResult } from "./assinaturaDigital.service";

export { enviarParaSefaz } from "./httpClient.service";
export type { SefazResponse, SefazRequestOptions, SefazCertificado } from "./httpClient.service";

export { autorizarNFe } from "./autorizacao.service";
export type { AutorizacaoResult } from "./autorizacao.service";

export { consultarNFe } from "./consulta.service";
export type { ConsultaResult } from "./consulta.service";

export { cancelarNFe } from "./cancelamento.service";
export type { CancelamentoResult } from "./cancelamento.service";

export { inutilizarNumeracao } from "./inutilizacao.service";
export type { InutilizacaoParams, InutilizacaoResult } from "./inutilizacao.service";

export { enviarCartaCorrecao } from "./cartaCorrecao.service";
export type { CartaCorrecaoParams, CartaCorrecaoResult } from "./cartaCorrecao.service";

export { resolverUrlSefaz, UFS_SUPORTADAS } from "./sefazUrls.service";
export type { SefazServico } from "./sefazUrls.service";

export type { CRT, AmbienteSefaz, IndIEDest } from "./xmlBuilder.service";
export { calcularIndIEDest } from "./xmlBuilder.service";
