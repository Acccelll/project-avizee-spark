/**
 * Parser client-side de XML de NF-e (Nota Fiscal Eletrônica)
 * Extrai dados do emitente, destinatário, itens e impostos.
 */

export interface NFeEmitente {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  inscricaoEstadual: string;
  uf: string;
}

export interface NFeItem {
  numero: number;
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  icms: number;
  ipi: number;
  pis: number;
  cofins: number;
}

export interface NFeData {
  numero: string;
  serie: string;
  chaveAcesso: string;
  dataEmissao: string;
  emitente: NFeEmitente;
  valorProdutos: number;
  valorFrete: number;
  valorDesconto: number;
  valorOutrasDespesas: number;
  icmsTotal: number;
  ipiTotal: number;
  pisTotal: number;
  cofinsTotal: number;
  icmsStTotal: number;
  valorTotal: number;
  itens: NFeItem[];
}

function text(el: Element | null, tag: string): string {
  return el?.getElementsByTagName(tag)?.[0]?.textContent?.trim() || "";
}

function num(el: Element | null, tag: string): number {
  return Number(text(el, tag)) || 0;
}

export function parseNFeXml(xmlString: string): NFeData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "text/xml");

  const parserError = doc.querySelector("parsererror");
  if (parserError) throw new Error("XML inválido: " + parserError.textContent);

  // Find the NFe/infNFe element
  const infNFe = doc.getElementsByTagName("infNFe")[0];
  if (!infNFe) throw new Error("Elemento infNFe não encontrado no XML");

  // Chave de acesso from Id attribute
  const chaveAcesso = (infNFe.getAttribute("Id") || "").replace(/^NFe/, "");

  // ide - identification
  const ide = infNFe.getElementsByTagName("ide")[0];
  const numero = text(ide, "nNF");
  const serie = text(ide, "serie");
  const dataEmissao = text(ide, "dhEmi").substring(0, 10);

  // emit - emitter
  const emit = infNFe.getElementsByTagName("emit")[0];
  const emitente: NFeEmitente = {
    cnpj: text(emit, "CNPJ"),
    razaoSocial: text(emit, "xNome"),
    nomeFantasia: text(emit, "xFant"),
    inscricaoEstadual: text(emit, "IE"),
    uf: text(emit?.getElementsByTagName("enderEmit")?.[0] || null, "UF"),
  };

  // det - items
  const dets = infNFe.getElementsByTagName("det");
  const itens: NFeItem[] = [];
  for (let i = 0; i < dets.length; i++) {
    const det = dets[i];
    const prod = det.getElementsByTagName("prod")[0];
    const imposto = det.getElementsByTagName("imposto")[0];

    // Try to find ICMS value in various ICMS groups
    let icmsVal = 0;
    const icmsGroups = ["ICMS00", "ICMS10", "ICMS20", "ICMS30", "ICMS40", "ICMS51", "ICMS60", "ICMS70", "ICMS90", "ICMSSN101", "ICMSSN102", "ICMSSN201", "ICMSSN202", "ICMSSN500", "ICMSSN900"];
    for (const g of icmsGroups) {
      const el = imposto?.getElementsByTagName(g)?.[0];
      if (el) { icmsVal = num(el, "vICMS"); break; }
    }

    const ipiEl = imposto?.getElementsByTagName("IPITrib")?.[0];
    const pisEl = imposto?.getElementsByTagName("PISAliq")?.[0] || imposto?.getElementsByTagName("PISOutr")?.[0];
    const cofinsEl = imposto?.getElementsByTagName("COFINSAliq")?.[0] || imposto?.getElementsByTagName("COFINSOutr")?.[0];

    itens.push({
      numero: Number(det.getAttribute("nItem")) || (i + 1),
      codigo: text(prod, "cProd"),
      descricao: text(prod, "xProd"),
      ncm: text(prod, "NCM"),
      cfop: text(prod, "CFOP"),
      unidade: text(prod, "uCom"),
      quantidade: num(prod, "qCom"),
      valorUnitario: num(prod, "vUnCom"),
      valorTotal: num(prod, "vProd"),
      icms: icmsVal,
      ipi: num(ipiEl, "vIPI"),
      pis: num(pisEl, "vPIS"),
      cofins: num(cofinsEl, "vCOFINS"),
    });
  }

  // ICMSTot - totals
  const total = infNFe.getElementsByTagName("ICMSTot")[0];

  return {
    numero,
    serie,
    chaveAcesso,
    dataEmissao,
    emitente,
    valorProdutos: num(total, "vProd"),
    valorFrete: num(total, "vFrete"),
    valorDesconto: num(total, "vDesc"),
    valorOutrasDespesas: num(total, "vOutro"),
    icmsTotal: num(total, "vICMS"),
    ipiTotal: num(total, "vIPI"),
    pisTotal: num(total, "vPIS"),
    cofinsTotal: num(total, "vCOFINS"),
    icmsStTotal: num(total, "vST"),
    valorTotal: num(total, "vNF"),
    itens,
  };
}
