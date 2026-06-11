/**
 * Converte um XML de NF-e (`procNFe` ou `NFe`) em `DanfeInput` para alimentar
 * `gerarDanfePdf`. Tolerante a campos ausentes — usado pelo Portal Fiscal a
 * partir do XML armazenado em `nfe_distribuicao.xml_nfe`.
 *
 * Implementação namespace-safe: tenta `getElementsByTagNameNS("*", tag)` antes
 * de cair para `getElementsByTagName(tag)`, garantindo leitura correta mesmo
 * quando o documento declara `xmlns="http://www.portalfiscal.inf.br/nfe"`.
 */
import type {
  DanfeInput,
  DanfeItemInput,
  DanfeDuplicataInput,
  DanfePagamentoInput,
  DanfeVolumeInput,
} from "./danfe.service";

/** Busca todos os elementos cujo *local name* casa com `tag`, ignorando namespace. */
function findAll(parent: Element | Document | null, tag: string): Element[] {
  if (!parent) return [];
  const anyParent = parent as unknown as {
    getElementsByTagNameNS?: (ns: string, name: string) => HTMLCollectionOf<Element>;
    getElementsByTagName: (name: string) => HTMLCollectionOf<Element>;
  };
  let list: HTMLCollectionOf<Element> | null = null;
  try {
    list = anyParent.getElementsByTagNameNS?.("*", tag) ?? null;
  } catch {
    list = null;
  }
  if (!list || list.length === 0) {
    list = anyParent.getElementsByTagName(tag);
  }
  return list ? Array.from(list) : [];
}

function pick(parent: Element | Document | null, tag: string): Element | null {
  const arr = findAll(parent, tag);
  return arr[0] ?? null;
}

function text(parent: Element | Document | null, tag: string): string {
  const el = pick(parent, tag);
  return (el?.textContent ?? "").trim();
}

function num(parent: Element | Document | null, tag: string): number {
  const v = text(parent, tag);
  if (!v) return 0;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function joinEndereco(node: Element | null): string {
  if (!node) return "";
  const partes = [
    text(node, "xLgr"),
    text(node, "nro"),
    text(node, "xCpl"),
    text(node, "xBairro"),
  ].filter(Boolean);
  return partes.join(", ");
}

const FRETE_LABEL: Record<string, string> = {
  "0": "0 - Emitente (CIF)",
  "1": "1 - Destinatário (FOB)",
  "2": "2 - Terceiros",
  "3": "3 - Próprio remetente",
  "4": "4 - Próprio destinatário",
  "9": "9 - Sem frete",
};

export function parseNfeXmlToDanfeInput(xml: string): DanfeInput {
  const doc = new DOMParser().parseFromString(xml, "application/xml");

  const infNFe = pick(doc, "infNFe");

  // Fallback: documento pode ser apenas resNFe (resumo distDFe).
  if (!infNFe) {
    const res = pick(doc, "resNFe");
    if (res) {
      const ch = text(res, "chNFe");
      const dh = text(res, "dhEmi");
      return {
        numero: "—",
        serie: null,
        modelo: null,
        data_emissao: dh,
        natureza_operacao: null,
        tipo: "saida",
        chave_acesso: ch || null,
        protocolo_autorizacao: null,
        status_sefaz: "resumo",
        ambiente_emissao: null,
        emitente: {
          razao_social: text(res, "xNome"),
          cnpj: text(res, "CNPJ") || text(res, "CPF") || null,
          inscricao_estadual: text(res, "IE") || null,
        },
        destinatario: { nome: "—" },
        itens: [],
        valor_total: num(res, "vNF"),
      };
    }
  }

  const ide = pick(infNFe, "ide");
  const emit = pick(infNFe, "emit");
  const dest = pick(infNFe, "dest");
  const total = pick(infNFe, "total");
  const icmsTot = pick(total, "ICMSTot");
  const infAdic = pick(infNFe, "infAdic");
  const infProt = pick(doc, "infProt");
  const transp = pick(infNFe, "transp");
  const transporta = pick(transp, "transporta");
  const veicTransp = pick(transp, "veicTransp");
  const cobr = pick(infNFe, "cobr");
  const fat = pick(cobr, "fat");
  const pag = pick(infNFe, "pag");

  const enderEmit = pick(emit, "enderEmit");
  const enderDest = pick(dest, "enderDest");
  const enderTransp = pick(transporta, "enderToma") ?? null;

  const tpNF = text(ide, "tpNF"); // 0=entrada, 1=saída
  const tpAmb = text(ide, "tpAmb"); // 1=produção, 2=homologação
  const cStat = text(infProt, "cStat");

  const itensEls = findAll(infNFe, "det");
  const itens: DanfeItemInput[] = itensEls.map((det) => {
    const prod = pick(det, "prod");
    const imposto = pick(det, "imposto");
    const icmsAny =
      pick(imposto, "ICMS00") ??
      pick(imposto, "ICMS10") ??
      pick(imposto, "ICMS20") ??
      pick(imposto, "ICMS30") ??
      pick(imposto, "ICMS40") ??
      pick(imposto, "ICMS41") ??
      pick(imposto, "ICMS50") ??
      pick(imposto, "ICMS51") ??
      pick(imposto, "ICMS60") ??
      pick(imposto, "ICMS70") ??
      pick(imposto, "ICMS90") ??
      pick(imposto, "ICMSSN101") ??
      pick(imposto, "ICMSSN102") ??
      pick(imposto, "ICMSSN201") ??
      pick(imposto, "ICMSSN202") ??
      pick(imposto, "ICMSSN500") ??
      pick(imposto, "ICMSSN900") ??
      pick(imposto, "ICMS");
    const ipiTrib = pick(pick(imposto, "IPI"), "IPITrib");
    return {
      codigo: text(prod, "cProd") || null,
      descricao: text(prod, "xProd"),
      ncm: text(prod, "NCM") || null,
      cfop: text(prod, "CFOP") || null,
      unidade: text(prod, "uCom") || null,
      quantidade: num(prod, "qCom"),
      valor_unitario: num(prod, "vUnCom"),
      valor_total: num(prod, "vProd"),
      cst: text(icmsAny, "CST") || text(icmsAny, "CSOSN") || null,
      base_icms: num(icmsAny, "vBC"),
      valor_icms: num(icmsAny, "vICMS"),
      aliquota_icms: num(icmsAny, "pICMS"),
      valor_ipi: num(ipiTrib, "vIPI"),
      aliquota_ipi: num(ipiTrib, "pIPI"),
    };
  });

  const chave =
    (infNFe?.getAttribute("Id") ?? "").replace(/^NFe/, "") ||
    text(infProt, "chNFe") ||
    null;

  const duplicatas: DanfeDuplicataInput[] = findAll(cobr, "dup").map((d) => ({
    numero: text(d, "nDup") || null,
    vencimento: text(d, "dVenc") || null,
    valor: num(d, "vDup"),
  }));

  const pagamentos: DanfePagamentoInput[] = findAll(pag, "detPag").map((p) => ({
    forma: text(p, "tPag") || null,
    valor: num(p, "vPag"),
  }));

  const volumes: DanfeVolumeInput[] = findAll(transp, "vol").map((v) => ({
    quantidade: num(v, "qVol"),
    especie: text(v, "esp") || null,
    marca: text(v, "marca") || null,
    numero: text(v, "nVol") || null,
    peso_liquido: num(v, "pesoL"),
    peso_bruto: num(v, "pesoB"),
  }));

  return {
    numero: text(ide, "nNF"),
    serie: text(ide, "serie") || null,
    modelo: text(ide, "mod") || null,
    data_emissao: text(ide, "dhEmi") || text(ide, "dEmi") || "",
    data_saida_entrada: text(ide, "dhSaiEnt") || text(ide, "dSaiEnt") || null,
    natureza_operacao: text(ide, "natOp") || null,
    tipo: tpNF === "0" ? "entrada" : "saida",
    chave_acesso: chave,
    protocolo_autorizacao: text(infProt, "nProt") || null,
    status_sefaz: cStat === "100" ? "autorizada" : null,
    ambiente_emissao: tpAmb === "2" ? "homologacao" : tpAmb === "1" ? "producao" : null,
    emitente: {
      razao_social: text(emit, "xNome"),
      nome_fantasia: text(emit, "xFant") || null,
      cnpj: text(emit, "CNPJ") || text(emit, "CPF") || null,
      inscricao_estadual: text(emit, "IE") || null,
      inscricao_municipal: text(emit, "IM") || null,
      cnae: text(emit, "CNAE") || null,
      crt: text(emit, "CRT") || null,
      endereco: joinEndereco(enderEmit) || null,
      bairro: text(enderEmit, "xBairro") || null,
      numero_endereco: text(enderEmit, "nro") || null,
      complemento: text(enderEmit, "xCpl") || null,
      cidade: text(enderEmit, "xMun") || null,
      uf: text(enderEmit, "UF") || null,
      cep: text(enderEmit, "CEP") || null,
      telefone: text(enderEmit, "fone") || null,
      pais: text(enderEmit, "xPais") || null,
    },
    destinatario: {
      nome: text(dest, "xNome"),
      cpf_cnpj: text(dest, "CNPJ") || text(dest, "CPF") || null,
      inscricao_estadual: text(dest, "IE") || null,
      indicador_ie: text(dest, "indIEDest") || null,
      email: text(dest, "email") || null,
      endereco: joinEndereco(enderDest) || null,
      bairro: text(enderDest, "xBairro") || null,
      numero_endereco: text(enderDest, "nro") || null,
      complemento: text(enderDest, "xCpl") || null,
      cidade: text(enderDest, "xMun") || null,
      uf: text(enderDest, "UF") || null,
      cep: text(enderDest, "CEP") || null,
      telefone: text(enderDest, "fone") || null,
      pais: text(enderDest, "xPais") || null,
    },
    transportador: transporta || veicTransp ? {
      razao_social: text(transporta, "xNome") || null,
      cnpj_cpf: text(transporta, "CNPJ") || text(transporta, "CPF") || null,
      inscricao_estadual: text(transporta, "IE") || null,
      endereco: text(transporta, "xEnder") || joinEndereco(enderTransp) || null,
      cidade: text(transporta, "xMun") || null,
      uf: text(transporta, "UF") || null,
      antt: text(veicTransp, "RNTC") || null,
      placa: text(veicTransp, "placa") || null,
      uf_placa: text(veicTransp, "UF") || null,
    } : undefined,
    modalidade_frete: text(transp, "modFrete") || null,
    fatura: fat ? {
      numero: text(fat, "nFat") || null,
      valor_original: num(fat, "vOrig"),
      valor_desconto: num(fat, "vDesc"),
      valor_liquido: num(fat, "vLiq"),
    } : undefined,
    duplicatas,
    pagamentos,
    volumes,
    itens,
    base_icms: num(icmsTot, "vBC"),
    base_icms_st: num(icmsTot, "vBCST"),
    valor_produtos: num(icmsTot, "vProd"),
    frete_valor: num(icmsTot, "vFrete"),
    valor_seguro: num(icmsTot, "vSeg"),
    desconto_valor: num(icmsTot, "vDesc"),
    outras_despesas: num(icmsTot, "vOutro"),
    valor_ii: num(icmsTot, "vII"),
    valor_fcp: num(icmsTot, "vFCP"),
    icms_valor: num(icmsTot, "vICMS"),
    icms_st_valor: num(icmsTot, "vST"),
    ipi_valor: num(icmsTot, "vIPI"),
    pis_valor: num(icmsTot, "vPIS"),
    cofins_valor: num(icmsTot, "vCOFINS"),
    valor_total_tributos: num(icmsTot, "vTotTrib"),
    valor_total: num(icmsTot, "vNF"),
    observacoes: text(infAdic, "infCpl") || text(infAdic, "infAdFisco") || null,
    info_fisco: text(infAdic, "infAdFisco") || null,
  };
}