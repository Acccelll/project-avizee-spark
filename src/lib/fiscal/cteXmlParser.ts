import { parseXmlLite, findFirst, findAll, child, textOf, numberOf, type XmlNode } from "./xmlLite";

export type CteTipoDocumento = "cte" | "cte_os";
export interface CteParticipante { doc: string; razaoSocial: string; uf: string; ie?: string; municipio?: string; municipioCod?: string; }
export interface CteIcms { cst: string | null; baseCalculo: number | null; aliquota: number | null; valor: number | null; }
export interface CteData {
  tipoDocumento: CteTipoDocumento; modelo: "57" | "67"; chaveAcesso: string; numero: string; serie: string;
  dataEmissao: string; tipoCte: "normal" | "complemento_valores" | "anulacao" | "substituto" | null;
  modal: string | null; cfop: string | null; naturezaOperacao: string | null; protocolo: string | null;
  ambiente: "homologacao" | "producao" | null; emitente: CteParticipante; remetente?: CteParticipante;
  destinatario?: CteParticipante; expedidor?: CteParticipante; recebedor?: CteParticipante;
  tomadorTipo: number | null; tomadorOutro?: CteParticipante;
  municipioInicio: string; municipioInicioUf: string; municipioInicioCod: string;
  municipioFim: string; municipioFimUf: string; municipioFimCod: string;
  produtoPredominante: string | null; quantidade: number | null; unidadeMedida: string | null;
  valorPrestacao: number | null; valorReceber: number | null; icms: CteIcms; chavesNfe: string[];
  dadosExtras: Record<string, unknown>;
}

const TIPO: Record<string, CteData["tipoCte"]> = { "0":"normal", "1":"complemento_valores", "2":"anulacao", "3":"substituto" };
const MODAL: Record<string, string> = { "01":"rodoviario", "02":"aereo", "03":"aquaviario", "04":"ferroviario", "05":"dutoviario", "06":"multimodal" };
const nullable = (v: string): string | null => v ? v : null;

function participante(node: XmlNode | null): CteParticipante | undefined {
  if (!node) return undefined;
  const doc = (textOf(node,"CNPJ") || textOf(node,"CPF")).replace(/\D/g, "");
  const razaoSocial = textOf(node,"xNome","xFant");
  const ender = child(node,"enderEmit") ?? child(node,"enderReme") ?? child(node,"enderDest") ?? child(node,"enderExped") ?? child(node,"enderReceb") ?? child(node,"enderToma") ?? node;
  if (!doc && !razaoSocial) return undefined;
  return { doc, razaoSocial, uf:textOf(ender,"UF"), ie:nullable(textOf(node,"IE")) ?? undefined, municipio:nullable(textOf(ender,"xMun")) ?? undefined, municipioCod:nullable(textOf(ender,"cMun")) ?? undefined };
}

export function isCteXml(xml: string): boolean {
  return /<(\w+:)?(cteProc|CTeOSProc|CTeOS|CTe)\b/i.test(xml) || /<(\w+:)?infCte(OS)?\b/i.test(xml);
}

export function parseCteXml(xml: string): CteData {
  const root = parseXmlLite(xml);
  const inf = findFirst(root,"infCte") ?? findFirst(root,"infCteOS");
  if (!inf) throw new Error("Elemento infCte/infCteOS não encontrado.");
  const ide = findFirst(inf,"ide");
  const modelo = textOf(ide,"mod") === "67" ? "67" : "57";
  const chaveAcesso = (inf.attrs.Id ?? "").replace(/^CTe/i, "").replace(/\D/g, "");
  const tomaRaw = textOf(findFirst(ide,"toma3"),"toma") || textOf(findFirst(ide,"toma4"),"toma") || textOf(ide,"toma");
  const tomaNum = tomaRaw === "" ? null : Number(tomaRaw);
  const tomaNode = findFirst(ide,"toma4") ?? findFirst(inf,"toma");
  const vPrest = findFirst(inf,"vPrest");
  const imp = findFirst(inf,"imp");
  const icmsWrap = findFirst(imp,"ICMS");
  const icmsGroup = icmsWrap?.children.find((c) => c.name.startsWith("ICMS")) ?? icmsWrap;
  const infCarga = findFirst(inf,"infCarga");
  const qNode = findAll(infCarga,"infQ")[0] ?? null;
  const chaves = new Set<string>();
  for (const n of [...findAll(inf,"chave"), ...findAll(inf,"chNFe")]) {
    const d = n.text.replace(/\D/g, ""); if (d.length === 44) chaves.add(d);
  }
  const rodo = findFirst(inf,"rodo");
  const comps = findAll(vPrest,"Comp").map((c) => ({ nome:textOf(c,"xNome"), valor:numberOf(c,"vComp") }));
  const tpAmb = textOf(ide,"tpAmb");
  return {
    tipoDocumento: modelo === "67" ? "cte_os" : "cte", modelo, chaveAcesso,
    numero:textOf(ide,"nCT"), serie:textOf(ide,"serie") || "1", dataEmissao:textOf(ide,"dhEmi","dEmi").slice(0,10),
    tipoCte:TIPO[textOf(ide,"tpCTe")] ?? null, modal:MODAL[textOf(ide,"modal")] ?? nullable(textOf(ide,"modal")),
    cfop:nullable(textOf(ide,"CFOP")), naturezaOperacao:nullable(textOf(ide,"natOp")),
    protocolo:nullable(textOf(findFirst(root,"infProt"),"nProt")), ambiente:tpAmb === "1" ? "producao" : tpAmb === "2" ? "homologacao" : null,
    emitente:participante(findFirst(inf,"emit")) ?? { doc:"",razaoSocial:"",uf:"" },
    remetente:participante(findFirst(inf,"rem")), destinatario:participante(findFirst(inf,"dest")), expedidor:participante(findFirst(inf,"exped")), recebedor:participante(findFirst(inf,"receb")),
    tomadorTipo:Number.isFinite(tomaNum as number) ? tomaNum : null, tomadorOutro:(tomaNum === 4 || modelo === "67") ? participante(tomaNode) : undefined,
    municipioInicio:textOf(ide,"xMunIni"), municipioInicioUf:textOf(ide,"UFIni"), municipioInicioCod:textOf(ide,"cMunIni"),
    municipioFim:textOf(ide,"xMunFim"), municipioFimUf:textOf(ide,"UFFim"), municipioFimCod:textOf(ide,"cMunFim"),
    produtoPredominante:nullable(textOf(infCarga,"proPred")), quantidade:numberOf(qNode,"qCarga"), unidadeMedida:nullable(textOf(qNode,"cUnid")),
    valorPrestacao:numberOf(vPrest,"vTPrest"), valorReceber:numberOf(vPrest,"vRec"),
    icms:{ cst:nullable(textOf(icmsGroup,"CST")), baseCalculo:numberOf(icmsGroup,"vBC"), aliquota:numberOf(icmsGroup,"pICMS"), valor:numberOf(icmsGroup,"vICMS") },
    chavesNfe:Array.from(chaves),
    dadosExtras:{ layout_origem:modelo === "67" ? "cte_os" : "cte", versao_layout:inf.attrs.versao ?? null, componentes_frete:comps, rntrc:nullable(textOf(rodo,"RNTRC")), valor_carga:numberOf(infCarga,"vCarga"), medidas:findAll(infCarga,"infQ").map((q)=>({tipo:textOf(q,"tpMed"),quantidade:numberOf(q,"qCarga"),unidade:textOf(q,"cUnid")})) }
  };
}
