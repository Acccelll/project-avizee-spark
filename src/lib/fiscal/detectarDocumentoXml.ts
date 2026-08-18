import { isCteXml } from "./cteXmlParser";
import { isNfseXml } from "./nfseXmlParser";
export type TipoDocumentoXml = "nfe"|"cte"|"cte_os"|"nfse"|"desconhecido";
export function detectarTipoDocumentoXml(xml:string):TipoDocumentoXml {
  if(!xml?.trim()) return "desconhecido";
  if(/<(\w+:)?(CTeOSProc|CTeOS)\b/i.test(xml)||/<(\w+:)?infCteOS\b/i.test(xml)) return "cte_os";
  if(isCteXml(xml)) return /<(\w+:)?mod>\s*67\s*<\//i.test(xml)?"cte_os":"cte";
  if(/<(\w+:)?infNFe\b/i.test(xml)||/<(\w+:)?(nfeProc|NFe)\b/i.test(xml)) return "nfe";
  if(isNfseXml(xml)) return "nfse";
  return "desconhecido";
}
