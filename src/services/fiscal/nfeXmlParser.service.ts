/**
 * Parser de XML de NF-e autorizada (procNFe / nfeProc / NFe).
 *
 * Extrai os campos necessários para enriquecer `nfe_distribuicao` e popular
 * `nfe_distribuicao_itens`. Usa o DOMParser nativo do browser — não acrescenta
 * dependência. Tolerante a XMLs com ou sem namespace prefix.
 */

export interface NFeXmlItem {
  numero: number;
  codigo: string | null;
  descricao: string;
  ncm: string | null;
  cfop: string | null;
  unidade: string | null;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface NFeXmlParsed {
  chave: string;
  numero: string;
  serie: string;
  dataEmissao: string | null;
  naturezaOperacao: string | null;
  cnpjEmitente: string | null;
  nomeEmitente: string | null;
  ufEmitente: string | null;
  ieEmitente: string | null;
  valorTotal: number;
  valorIcms: number;
  valorIpi: number;
  protocolo: string | null;
  itens: NFeXmlItem[];
}

function text(el: Element | null | undefined, tag: string): string | null {
  if (!el) return null;
  // getElementsByTagName ignora prefixo de namespace (funciona para "nfe:emit" e "emit")
  const node = el.getElementsByTagName(tag)[0];
  return node?.textContent?.trim() || null;
}

function num(el: Element | null | undefined, tag: string): number {
  const v = text(el, tag);
  if (!v) return 0;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Extrai chave de acesso. Aceita atributo Id="NFe<44>" do <infNFe> ou
 * o conteúdo de <chNFe> (nfeProc).
 */
function extrairChave(doc: Document): string | null {
  const infNFe = doc.getElementsByTagName("infNFe")[0];
  const id = infNFe?.getAttribute("Id");
  if (id && /^NFe\d{44}$/.test(id)) return id.slice(3);
  const ch = doc.getElementsByTagName("chNFe")[0]?.textContent?.trim();
  if (ch && /^\d{44}$/.test(ch)) return ch;
  return null;
}

/**
 * Faz o parse de um XML de NF-e (string) e devolve os dados estruturados.
 * Lança Error se o XML for inválido ou não contiver uma NFe identificável.
 */
export function parseNFeXml(xmlString: string): NFeXmlParsed {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "application/xml");

  // Detecta erro do próprio DOMParser
  const parseError = doc.getElementsByTagName("parsererror")[0];
  if (parseError) {
    throw new Error("XML inválido: não foi possível interpretar o arquivo.");
  }

  const chave = extrairChave(doc);
  if (!chave) {
    throw new Error("XML não parece ser uma NF-e (chave de acesso não encontrada).");
  }

  const ide = doc.getElementsByTagName("ide")[0] ?? null;
  const emit = doc.getElementsByTagName("emit")[0] ?? null;
  const enderEmit = emit?.getElementsByTagName("enderEmit")[0] ?? null;
  const total = doc.getElementsByTagName("ICMSTot")[0] ?? null;
  const protNFe = doc.getElementsByTagName("protNFe")[0] ?? null;
  const infProt = protNFe?.getElementsByTagName("infProt")[0] ?? null;

  const dataEmissao =
    text(ide, "dhEmi") ?? text(ide, "dEmi") ?? null;

  const itens: NFeXmlItem[] = [];
  const detList = doc.getElementsByTagName("det");
  for (let i = 0; i < detList.length; i += 1) {
    const det = detList[i];
    const prod = det.getElementsByTagName("prod")[0];
    if (!prod) continue;
    const numAttr = det.getAttribute("nItem");
    itens.push({
      numero: numAttr ? parseInt(numAttr, 10) : i + 1,
      codigo: text(prod, "cProd"),
      descricao: text(prod, "xProd") ?? "(sem descrição)",
      ncm: text(prod, "NCM"),
      cfop: text(prod, "CFOP"),
      unidade: text(prod, "uCom"),
      quantidade: num(prod, "qCom"),
      valorUnitario: num(prod, "vUnCom"),
      valorTotal: num(prod, "vProd"),
    });
  }

  return {
    chave,
    numero: text(ide, "nNF") ?? "",
    serie: text(ide, "serie") ?? "",
    dataEmissao,
    naturezaOperacao: text(ide, "natOp"),
    cnpjEmitente: text(emit, "CNPJ"),
    nomeEmitente: text(emit, "xNome"),
    ufEmitente: text(enderEmit, "UF"),
    ieEmitente: text(emit, "IE"),
    valorTotal: num(total, "vNF"),
    valorIcms: num(total, "vICMS"),
    valorIpi: num(total, "vIPI"),
    protocolo: text(infProt, "nProt"),
    itens,
  };
}