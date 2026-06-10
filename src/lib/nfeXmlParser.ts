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

export interface NFeDestinatario {
  /** CNPJ ou CPF do destinatário (apenas dígitos). */
  cpfCnpj: string;
  /** "J" se CNPJ (14), "F" se CPF (11). */
  tipoPessoa: "F" | "J";
  razaoSocial: string;
  inscricaoEstadual: string;
  /** indIEDest do XML: "1" contribuinte, "2" isento, "9" não contribuinte. */
  indIEDest: string;
  uf: string;
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  email: string;
  telefone: string;
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
  /** Destinatário (dest) — usado para identificar cliente em NF de saída. */
  destinatario?: NFeDestinatario;
  /** tpNF do XML: "0" entrada, "1" saída. */
  tpNF: "0" | "1" | null;
  /** Modelo do documento (mod): "55" NF-e, "65" NFC-e. */
  modelo: string | null;
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
  cobranca?: NFeCobranca;
  /** Natureza da operação (ide/natOp). */
  naturezaOperacao?: string | null;
  /** Protocolo de autorização (protNFe/infProt/nProt) — quando o XML é o procNFe autorizado. */
  protocolo?: string | null;
}

export interface NFeDuplicata {
  numero: string;
  vencimento: string; // ISO yyyy-mm-dd
  valor: number;
}

export interface NFeCobranca {
  fatura?: { numero: string; valorOriginal: number; valorDesconto: number; valorLiquido: number };
  duplicatas: NFeDuplicata[];
  /** Código tPag SEFAZ do primeiro detPag, ou null se ausente. */
  tPag: string | null;
  /** true se identificado pagamento à vista (sem duplicatas e tPag != boleto). */
  aVista: boolean;
}

function text(el: Element | null, tag: string): string {
  return el?.getElementsByTagName(tag)?.[0]?.textContent?.trim() || "";
}

function num(el: Element | null, tag: string): number {
  return Number(text(el, tag)) || 0;
}

/**
 * Escapa `&` que não pertencem a uma entidade XML válida (&amp; &lt; &gt; &quot; &apos; &#123; &#xAB;).
 * Útil para corrigir XMLs vindos de APIs que perderam o escape original em campos de texto.
 */
function sanitizeBareAmpersands(xml: string): string {
  return xml.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, "&amp;");
}

export function parseNFeXml(xmlString: string): NFeData {
  const parser = new DOMParser();
  let doc = parser.parseFromString(xmlString, "text/xml");
  let parserError = doc.querySelector("parsererror");

  // Algumas APIs de fallback (ex.: consultadanfe) retornam XML com `&` cru
  // dentro de valores de campos (xNome, infCpl, etc.), o que faz o parser
  // estourar com "xmlParseEntityRef: no name". Tentamos sanitizar e re-parsear.
  if (parserError) {
    const sanitized = sanitizeBareAmpersands(xmlString);
    if (sanitized !== xmlString) {
      doc = parser.parseFromString(sanitized, "text/xml");
      parserError = doc.querySelector("parsererror");
    }
  }

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
  const tpNFRaw = text(ide, "tpNF");
  const tpNF: NFeData["tpNF"] = tpNFRaw === "0" || tpNFRaw === "1" ? tpNFRaw : null;
  const modelo = text(ide, "mod") || null;

  // emit - emitter
  const emit = infNFe.getElementsByTagName("emit")[0];
  const emitente: NFeEmitente = {
    cnpj: text(emit, "CNPJ"),
    razaoSocial: text(emit, "xNome"),
    nomeFantasia: text(emit, "xFant"),
    inscricaoEstadual: text(emit, "IE"),
    uf: text(emit?.getElementsByTagName("enderEmit")?.[0] || null, "UF"),
  };

  // dest - destinatário (presente em quase todas as NF-e, exceto algumas NFC-e)
  const destEl = infNFe.getElementsByTagName("dest")[0] || null;
  let destinatario: NFeDestinatario | undefined;
  if (destEl) {
    const enderDest = destEl.getElementsByTagName("enderDest")[0] || null;
    const cnpjDest = text(destEl, "CNPJ");
    const cpfDest = text(destEl, "CPF");
    const cpfCnpj = (cnpjDest || cpfDest).replace(/\D/g, "");
    destinatario = {
      cpfCnpj,
      tipoPessoa: cnpjDest ? "J" : "F",
      razaoSocial: text(destEl, "xNome"),
      inscricaoEstadual: text(destEl, "IE"),
      indIEDest: text(destEl, "indIEDest"),
      uf: text(enderDest, "UF"),
      cep: text(enderDest, "CEP"),
      logradouro: text(enderDest, "xLgr"),
      numero: text(enderDest, "nro"),
      bairro: text(enderDest, "xBairro"),
      municipio: text(enderDest, "xMun"),
      email: text(destEl, "email"),
      telefone: text(enderDest, "fone"),
    };
  }

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

  // protNFe (presente apenas em procNFe autorizado)
  const protNFe = doc.getElementsByTagName("protNFe")[0];
  const infProt = protNFe?.getElementsByTagName("infProt")?.[0];
  const protocolo = text(infProt || null, "nProt") || null;
  const naturezaOperacao = text(ide, "natOp") || null;

  // cobr / dup
  const cobr = infNFe.getElementsByTagName("cobr")[0];
  const duplicatas: NFeDuplicata[] = [];
  let fatura: NFeCobranca["fatura"] | undefined;
  if (cobr) {
    const fat = cobr.getElementsByTagName("fat")[0];
    if (fat) {
      fatura = {
        numero: text(fat, "nFat"),
        valorOriginal: num(fat, "vOrig"),
        valorDesconto: num(fat, "vDesc"),
        valorLiquido: num(fat, "vLiq"),
      };
    }
    const dups = cobr.getElementsByTagName("dup");
    for (let i = 0; i < dups.length; i++) {
      const d = dups[i];
      duplicatas.push({
        numero: text(d, "nDup") || String(i + 1),
        vencimento: text(d, "dVenc"),
        valor: num(d, "vDup"),
      });
    }
  }

  // pag / detPag
  const pag = infNFe.getElementsByTagName("pag")[0];
  let tPag: string | null = null;
  if (pag) {
    const detPag = pag.getElementsByTagName("detPag")[0] || pag;
    tPag = text(detPag, "tPag") || null;
  }

  // Fallback: alguns emissores não preenchem <cobr>/<dup> e indicam o(s)
  // vencimento(s) apenas em infAdic/infCpl no formato "VENCT. dd/mm/aaaa" ou
  // "VENCT.1 dd/mm/aaaa; VENCT.2 dd/mm/aaaa".
  if (duplicatas.length === 0) {
    const infAdic = infNFe.getElementsByTagName("infAdic")[0];
    const infCpl = text(infAdic || null, "infCpl");
    if (infCpl) {
      const re = /VENCT[\.\s]*(\d*)[\s:.\-]*([0-3]?\d)[\/\-]([01]?\d)[\/\-](\d{2,4})/gi;
      const matches: Array<{ idx: number; iso: string }> = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(infCpl)) !== null) {
        const idx = m[1] ? Number(m[1]) : matches.length + 1;
        const dd = m[2].padStart(2, "0");
        const mm = m[3].padStart(2, "0");
        let yyyy = m[4];
        if (yyyy.length === 2) yyyy = (Number(yyyy) >= 70 ? "19" : "20") + yyyy;
        matches.push({ idx, iso: `${yyyy}-${mm}-${dd}` });
      }
      if (matches.length > 0) {
        const valorNF = num(total, "vNF");
        const n = matches.length;
        const baseCent = Math.floor((valorNF * 100) / n);
        const restoCent = Math.round(valorNF * 100) - baseCent * n;
        matches
          .sort((a, b) => a.idx - b.idx)
          .forEach((mt, i) => {
            const cent = baseCent + (i === n - 1 ? restoCent : 0);
            duplicatas.push({
              numero: String(mt.idx || i + 1),
              vencimento: mt.iso,
              valor: cent / 100,
            });
          });
        // Sem <pag>/<detPag> explícito, "VENCT." em texto livre é sinal forte
        // de boleto a prazo.
        if (!tPag) tPag = "15";
      }
    }
  }

  const aVista = duplicatas.length === 0 && tPag !== null && !["02", "15"].includes(tPag);

  return {
    numero,
    serie,
    chaveAcesso,
    dataEmissao,
    emitente,
    destinatario,
    tpNF,
    modelo,
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
    cobranca: { fatura, duplicatas, tPag, aVista },
    naturezaOperacao,
    protocolo,
  };
}
