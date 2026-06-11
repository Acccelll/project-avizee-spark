/**
 * Converte um XML de NF-e (`procNFe` ou `NFe`) em `DanfeInput` para alimentar
 * `gerarDanfePdf`. Tolerante a campos ausentes — usado pelo Portal Fiscal a
 * partir do XML armazenado em `nfe_distribuicao.xml_nfe`.
 */
import type { DanfeInput, DanfeItemInput } from "./danfe.service";

function text(parent: Element | Document | null, tag: string): string {
  if (!parent) return "";
  const el = parent.getElementsByTagName(tag)[0];
  return (el?.textContent ?? "").trim();
}

function num(parent: Element | Document | null, tag: string): number {
  const v = text(parent, tag);
  if (!v) return 0;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function pick<T extends Element>(parent: Element | Document | null, tag: string): T | null {
  if (!parent) return null;
  return (parent.getElementsByTagName(tag)[0] as T | undefined) ?? null;
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

export function parseNfeXmlToDanfeInput(xml: string): DanfeInput {
  const doc = new DOMParser().parseFromString(xml, "application/xml");

  const infNFe = pick(doc, "infNFe");
  const ide = pick(infNFe, "ide");
  const emit = pick(infNFe, "emit");
  const dest = pick(infNFe, "dest");
  const total = pick(infNFe, "total");
  const icmsTot = pick(total, "ICMSTot");
  const infAdic = pick(infNFe, "infAdic");
  const infProt = pick(doc, "infProt");

  const enderEmit = pick(emit, "enderEmit");
  const enderDest = pick(dest, "enderDest");

  const tpNF = text(ide, "tpNF"); // 0=entrada, 1=saída
  const tpAmb = text(ide, "tpAmb"); // 1=produção, 2=homologação
  const cStat = text(infProt, "cStat");

  const itensEls = infNFe ? Array.from(infNFe.getElementsByTagName("det")) : [];
  const itens: DanfeItemInput[] = itensEls.map((det) => {
    const prod = pick(det, "prod");
    return {
      codigo: text(prod, "cProd") || null,
      descricao: text(prod, "xProd"),
      ncm: text(prod, "NCM") || null,
      cfop: text(prod, "CFOP") || null,
      unidade: text(prod, "uCom") || null,
      quantidade: num(prod, "qCom"),
      valor_unitario: num(prod, "vUnCom"),
      valor_total: num(prod, "vProd"),
    };
  });

  const chave = (infNFe?.getAttribute("Id") ?? "").replace(/^NFe/, "") || null;

  return {
    numero: text(ide, "nNF"),
    serie: text(ide, "serie") || null,
    modelo: text(ide, "mod") || null,
    data_emissao: text(ide, "dhEmi") || text(ide, "dEmi") || "",
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
      endereco: joinEndereco(enderEmit) || null,
      cidade: text(enderEmit, "xMun") || null,
      uf: text(enderEmit, "UF") || null,
      cep: text(enderEmit, "CEP") || null,
      telefone: text(enderEmit, "fone") || null,
    },
    destinatario: {
      nome: text(dest, "xNome"),
      cpf_cnpj: text(dest, "CNPJ") || text(dest, "CPF") || null,
      inscricao_estadual: text(dest, "IE") || null,
      endereco: joinEndereco(enderDest) || null,
      cidade: text(enderDest, "xMun") || null,
      uf: text(enderDest, "UF") || null,
      cep: text(enderDest, "CEP") || null,
    },
    itens,
    valor_produtos: num(icmsTot, "vProd"),
    frete_valor: num(icmsTot, "vFrete"),
    desconto_valor: num(icmsTot, "vDesc"),
    outras_despesas: num(icmsTot, "vOutro"),
    icms_valor: num(icmsTot, "vICMS"),
    icms_st_valor: num(icmsTot, "vST"),
    ipi_valor: num(icmsTot, "vIPI"),
    pis_valor: num(icmsTot, "vPIS"),
    cofins_valor: num(icmsTot, "vCOFINS"),
    valor_total: num(icmsTot, "vNF"),
    observacoes: text(infAdic, "infCpl") || text(infAdic, "infAdFisco") || null,
  };
}