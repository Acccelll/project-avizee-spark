import { parseXmlLite, findFirst, textOf, numberOf, type XmlNode } from "./xmlLite";

export type NfseLayoutOrigem = "nacional" | "dps" | "abrasf" | "desconhecido";
export type NfseTributo = "ISS"|"INSS"|"IRRF"|"PIS"|"COFINS"|"CSLL"|"IBS"|"CBS";
export interface NfsePessoa { doc:string; tipoDoc:"CNPJ"|"CPF"|null; razaoSocial:string; inscricaoMunicipal?:string; municipioCod?:string; uf?:string; }
export interface NfseRetencaoParsed { tributo:NfseTributo; base_calculo:number; aliquota:number|null; valor:number; retido:boolean; reduz_valor_fornecedor:boolean; responsavel_recolhimento:"empresa"|"fornecedor"; origem:"xml"; }
export interface NfseData {
  layoutOrigem:NfseLayoutOrigem; versaoLayout:string|null; provedorOrigem:string|null;
  numero:string; serie:string; chaveAcesso:string|null; dataEmissao:string; competencia:string|null; numeroRps:string|null; serieRps:string|null;
  prestador:NfsePessoa; tomador?:NfsePessoa; codigoServicoLc116:string|null; codigoNbs:string|null; descricaoServico:string|null;
  municipioPrestacao:string|null; municipioPrestacaoCod:string|null; valorServicos:number; valorDeducoes:number;
  baseCalculoInformada:number|null; aliquotaIss:number|null; valorIssInformado:number|null; issRetido:boolean; valorLiquidoInformado:number|null;
  retencoes:NfseRetencaoParsed[]; ibsCbs:{ibsValor:number|null;cbsValor:number|null}|null;
  optanteSimples:boolean|null; incentivadorCultural:boolean|null; dadosExtras:Record<string,unknown>;
}

export function isNfseXml(xml:string):boolean {
  return /<(\w+:)?(NFSe|infNFSe|DPS|infDPS|CompNfse|Nfse|InfNfse)\b/i.test(xml);
}

function pessoa(node:XmlNode|null):NfsePessoa|undefined {
  if (!node) return undefined;
  const cnpj=textOf(node,"CNPJ","Cnpj").replace(/\D/g,""); const cpf=textOf(node,"CPF","Cpf").replace(/\D/g,"");
  const doc=cnpj||cpf; const razaoSocial=textOf(node,"xNome","RazaoSocial","xFant","NomeFantasia");
  if (!doc && !razaoSocial) return undefined;
  return { doc, tipoDoc:cnpj?"CNPJ":cpf?"CPF":null, razaoSocial, inscricaoMunicipal:textOf(node,"IM","InscricaoMunicipal")||undefined, municipioCod:textOf(node,"cMun","CodigoMunicipio")||undefined, uf:textOf(node,"UF","Uf")||undefined };
}

export function normalizarAliquota(raw:number|null):number|null {
  if (raw === null || !Number.isFinite(raw) || raw < 0) return null;
  return raw > 1 ? +(raw/100).toFixed(6) : raw;
}

function ret(tributo:NfseTributo, valor:number|null, base:number, aliquota:number|null, retido=true, reduz=true):NfseRetencaoParsed|null {
  if (valor === null || !Number.isFinite(valor) || valor <= 0) return null;
  return { tributo, base_calculo:base, aliquota, valor:+valor.toFixed(2), retido, reduz_valor_fornecedor:reduz, responsavel_recolhimento:retido?"empresa":"fornecedor", origem:"xml" };
}

export function parseNfseXml(xml:string):NfseData {
  const root=parseXmlLite(xml); const infNFSe=findFirst(root,"infNFSe"); const infDPS=findFirst(root,"infDPS"); const abrasf=findFirst(root,"InfNfse");
  const layout:NfseLayoutOrigem=infNFSe?"nacional":infDPS?"dps":abrasf?"abrasf":"desconhecido";
  const base=infNFSe??abrasf??infDPS; if(!base) throw new Error("Documento NFS-e não reconhecido.");
  const dps=infDPS??findFirst(base,"infDPS"); const serv=findFirst(base,"serv")??findFirst(base,"Servico")??base; const valores=findFirst(serv,"Valores")??findFirst(base,"valores")??findFirst(base,"valoresNFSe")??serv;
  const prestNode=findFirst(base,"prest")??findFirst(base,"PrestadorServico")??findFirst(dps,"prest"); const tomaNode=findFirst(base,"toma")??findFirst(base,"TomadorServico")??findFirst(base,"Tomador");
  const valorServicos=numberOf(base,"vServ","vServPrest","ValorServicos")??0; const valorDeducoes=numberOf(base,"vDedRed","ValorDeducoes")??0;
  const baseCalc=numberOf(base,"vBC","BaseCalculo","vBCISS"); const aliq=normalizarAliquota(numberOf(base,"pAliq","Aliquota","pAliqAplic")); const iss=numberOf(base,"vISS","ValorIss","vIssqn");
  const issRaw=textOf(base,"tpRetISSQN","IssRetido","indISSRet"); const issRetido=issRaw === "1" || issRaw === "2" || issRaw.toLowerCase() === "true";
  const baseRet=baseCalc??Math.max(0,valorServicos-valorDeducoes); const retencoes:NfseRetencaoParsed[]=[];
  const push=(r:NfseRetencaoParsed|null)=>{if(r)retencoes.push(r)};
  push(ret("ISS",issRetido?iss:null,baseRet,aliq,issRetido,true));
  for(const [t,tags] of [["PIS",["vRetPIS","ValorPis","vPIS"]],["COFINS",["vRetCOFINS","ValorCofins","vCOFINS"]],["INSS",["vRetINSS","ValorInss","vINSS"]],["IRRF",["vRetIRRF","ValorIr","vIR","vIRRF"]],["CSLL",["vRetCSLL","ValorCsll","vCSLL"]]] as Array<[NfseTributo,string[]]>) push(ret(t,numberOf(valores,...tags)??numberOf(base,...tags),baseRet,null));
  const ibs=numberOf(base,"vIBS","vIBSTot"); const cbs=numberOf(base,"vCBS","vCBSTot");
  const data=textOf(base,"dhProc","dhEmi","DataEmissao"); const competencia=textOf(base,"dCompet","Competencia"); const simples=textOf(base,"opSimpNac","OptanteSimplesNacional"); const cultural=textOf(base,"IncentivadorCultural","indIncentivo");
  const chave=(infNFSe?.attrs.Id??"").replace(/^NFS?e/i,"").replace(/\D/g,"");
  return {
    layoutOrigem:layout, versaoLayout:root.attrs.versao??base.attrs.versao??null, provedorOrigem:(layout === "nacional"||layout === "dps")?"adn_nacional":"municipal_abrasf",
    numero:textOf(base,"nNFSe","Numero","nDPS"), serie:textOf(base,"serie","Serie")||"1", chaveAcesso:chave||null, dataEmissao:data.slice(0,10), competencia:competencia?competencia.slice(0,10):null,
    numeroRps:textOf(findFirst(base,"IdentificacaoRps")??dps??base,"nDPS","Numero")||null, serieRps:textOf(findFirst(base,"IdentificacaoRps")??dps??base,"serie","Serie")||null,
    prestador:pessoa(prestNode)??{doc:"",tipoDoc:null,razaoSocial:""}, tomador:pessoa(tomaNode), codigoServicoLc116:textOf(serv,"cTribNac","ItemListaServico","cServ")||null, codigoNbs:textOf(serv,"cNBS","CodigoNbs")||null,
    descricaoServico:textOf(serv,"xDescServ","Discriminacao","xDisc")||null, municipioPrestacao:textOf(base,"xMunPrestacao","xMun")||null, municipioPrestacaoCod:textOf(base,"cLocPrestacao","cMunPrestacao","CodigoMunicipio")||null,
    valorServicos, valorDeducoes, baseCalculoInformada:baseCalc, aliquotaIss:aliq, valorIssInformado:iss, issRetido, valorLiquidoInformado:numberOf(base,"vLiq","ValorLiquidoNfse","vLiquido"), retencoes,
    ibsCbs:(ibs!==null||cbs!==null)?{ibsValor:ibs,cbsValor:cbs}:null, optanteSimples:simples?simples === "1"||simples.toLowerCase()==="true":null, incentivadorCultural:cultural?cultural === "1"||cultural.toLowerCase()==="true":null,
    dadosExtras:{ codigo_verificacao:textOf(base,"CodigoVerificacao")||undefined, municipio_incidencia:textOf(base,"cMunIncid","MunicipioIncidencia")||undefined, regime_especial:textOf(base,"regEspTrib","RegimeEspecialTributacao")||undefined }
  };
}
