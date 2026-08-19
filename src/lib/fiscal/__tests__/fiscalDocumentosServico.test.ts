import { describe,it,expect } from "vitest";
import { percentualParaDecimal,decimalParaPercentual } from "../aliquota";
import { calcularNfse,validarNfse } from "../nfseCalculo";
import { calcularRateioCte } from "../cteRateio";
import { detectarTipoDocumentoXml } from "../detectarDocumentoXml";
import { parseCteXml } from "../cteXmlParser";
import { parseNfseXml } from "../nfseXmlParser";

describe("alíquotas",()=>{it("converte UI percentual para fração",()=>{expect(percentualParaDecimal(5)).toBe(.05);expect(decimalParaPercentual(.05)).toBe(5);});});
describe("NFS-e",()=>{it("calcula líquido e detecta divergência",()=>{const ret={tributo:"ISS" as const,base_calculo:1000,aliquota:.05,valor:50,retido:true,reduz_valor_fornecedor:true,responsavel_recolhimento:"empresa" as const,status:"rascunho" as const}; const c=calcularNfse({valorServicos:1000,aliquotaIss:.05,retencoes:[ret]});expect(c.valorIssCalculado).toBe(50);expect(c.liquidoFornecedor).toBe(950);expect(validarNfse({valorServicos:1000,aliquotaIss:.05,valorIssInformado:80}).some(x=>x.severidade==="aviso")).toBe(true);});});
describe("CT-e rateio",()=>{it("não aplica subconjunto quando falta uma NF-e",()=>{const r=calcularRateioCte(100,[{nfeChave:"A",nfeId:"1",statusVinculo:"localizada",valorBaseNfe:400},{nfeChave:"B",nfeId:null,statusVinculo:"nao_localizada",valorBaseNfe:null}]);expect(r.podeAplicar).toBe(false);expect(r.valorAplicado).toBe(0);expect(r.valorPendente).toBe(100);});});
describe("parsers",()=>{it("detecta e extrai CT-e",()=>{const xml='<cteProc><CTe><infCte Id="CTe35111111111111111111111111111111111111111111"><ide><mod>57</mod><serie>1</serie><nCT>123</nCT><dhEmi>2026-08-01T10:00:00-03:00</dhEmi><modal>01</modal></ide><emit><CNPJ>12345678000199</CNPJ><xNome>T</xNome></emit><vPrest><vTPrest>100</vTPrest><vRec>90</vRec></vPrest></infCte></CTe></cteProc>';expect(detectarTipoDocumentoXml(xml)).toBe("cte");expect(parseCteXml(xml).valorReceber).toBe(90);});it("detecta e extrai NFS-e",()=>{const xml='<NFSe versao="1.01"><infNFSe Id="NFS123"><nNFSe>7</nNFSe><emit><CNPJ>12345678000199</CNPJ><xNome>P</xNome></emit><valores><vServ>1000</vServ><vBC>1000</vBC><pAliq>5</pAliq><vISS>50</vISS><tpRetISSQN>1</tpRetISSQN></valores></infNFSe></NFSe>';expect(detectarTipoDocumentoXml(xml)).toBe("nfse");const n=parseNfseXml(xml);expect(n.aliquotaIss).toBe(.05);expect(n.retencoes[0].tributo).toBe("ISS");});});
