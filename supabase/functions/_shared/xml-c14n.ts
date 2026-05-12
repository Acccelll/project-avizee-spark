/**
 * XML Canonicalization (Exclusive C14N - http://www.w3.org/2001/10/xml-exc-c14n#)
 *
 * Implementação focada em XML NFe (sem comentários, sem PIs internas, sem CDATA).
 * Conformidade com https://www.w3.org/TR/xml-exc-c14n/ no subconjunto necessário:
 *  - Ordenação de atributos: namespaces primeiro (xmlns, xmlns:*) por prefixo;
 *    depois atributos por (URI namespace, localName).
 *  - Escape de texto: & → &amp;, < → &lt;, > → &gt;, CR (0x0D) → &#xD;
 *  - Escape de atributo: & < " e CR/LF/TAB para entidades numéricas.
 *  - Self-closing tags expandidas para forma <a></a>.
 *  - Apenas namespaces "visivelmente utilizados" no subtree são emitidos
 *    (regra exclusiva). InclusiveNamespaces não suportado (NFe não usa).
 *
 * NÃO use para XML genérico que contenha comentários, PIs, CDATA ou
 * herança complexa de namespaces — escreva fixtures para o caso novo.
 */

import { DOMParser } from "npm:@xmldom/xmldom@0.9.4";

type AnyNode = {
  nodeType: number;
  nodeName: string;
  localName?: string | null;
  prefix?: string | null;
  namespaceURI?: string | null;
  nodeValue?: string | null;
  attributes?: ArrayLike<AnyNode> | null;
  childNodes?: ArrayLike<AnyNode> | null;
  parentNode?: AnyNode | null;
};

const NODE_ELEMENT = 1;
const NODE_ATTRIBUTE = 2;
const NODE_TEXT = 3;

function escapeText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\r/g, "&#xD;");
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/\t/g, "&#x9;")
    .replace(/\n/g, "&#xA;")
    .replace(/\r/g, "&#xD;");
}

/** Coleta atributos namespace-decl e regulares. */
function partitionAttrs(el: AnyNode) {
  const nsDecls: Array<{ name: string; value: string }> = [];
  const attrs: Array<{ ns: string | null; localName: string; name: string; value: string }> = [];
  const list = el.attributes ?? [];
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    const name = a.nodeName;
    const value = a.nodeValue ?? "";
    if (name === "xmlns" || name.startsWith("xmlns:")) {
      nsDecls.push({ name, value });
    } else {
      attrs.push({
        ns: a.namespaceURI ?? null,
        localName: a.localName ?? name,
        name,
        value,
      });
    }
  }
  return { nsDecls, attrs };
}

/** Ns decls do subtree visivelmente utilizadas (prefix usado no elemento ou em algum atributo). */
function visiblyUsedPrefixes(el: AnyNode): Set<string> {
  const used = new Set<string>();
  // prefix do próprio elemento (default = "")
  used.add(el.prefix ?? "");
  const list = el.attributes ?? [];
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.nodeName === "xmlns" || a.nodeName.startsWith("xmlns:")) continue;
    if (a.prefix) used.add(a.prefix);
  }
  return used;
}

function serializeElement(el: AnyNode, inheritedNs: Map<string, string>): string {
  const tag = el.nodeName;
  const { nsDecls, attrs } = partitionAttrs(el);

  // Mapa de prefixos visíveis no escopo deste elemento (após aplicar nsDecls locais)
  const localScope = new Map(inheritedNs);
  for (const d of nsDecls) {
    const prefix = d.name === "xmlns" ? "" : d.name.slice(6);
    localScope.set(prefix, d.value);
  }

  // Exclusive C14N: emitir apenas ns decls visivelmente utilizadas que diferem do contexto pai
  const used = visiblyUsedPrefixes(el);
  const emittedNs: Array<{ name: string; value: string }> = [];
  for (const prefix of used) {
    const value = localScope.get(prefix);
    if (value === undefined) continue; // sem declaração no escopo (impossível em XML válido)
    if (inheritedNs.get(prefix) === value) continue; // já vigente no pai
    emittedNs.push({
      name: prefix === "" ? "xmlns" : `xmlns:${prefix}`,
      value,
    });
  }
  // Ordenar nsDecls por nome
  emittedNs.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  // Ordenar atributos: por (namespaceURI, localName); URI null vem antes
  const sortedAttrs = [...attrs].sort((a, b) => {
    const an = a.ns ?? "";
    const bn = b.ns ?? "";
    if (an !== bn) return an < bn ? -1 : 1;
    return a.localName < b.localName ? -1 : a.localName > b.localName ? 1 : 0;
  });

  let out = `<${tag}`;
  for (const ns of emittedNs) out += ` ${ns.name}="${escapeAttr(ns.value)}"`;
  for (const at of sortedAttrs) out += ` ${at.name}="${escapeAttr(at.value)}"`;
  out += ">";

  // Filhos
  const children = el.childNodes ?? [];
  for (let i = 0; i < children.length; i++) {
    const c = children[i];
    if (c.nodeType === NODE_ELEMENT) {
      out += serializeElement(c, localScope);
    } else if (c.nodeType === NODE_TEXT) {
      out += escapeText(c.nodeValue ?? "");
    }
    // Comentários, PIs, CDATA ignorados (não esperados em NFe)
  }

  out += `</${tag}>`;
  return out;
}

/**
 * Canonicaliza um fragmento XML usando exclusive C14N (sem comentários).
 * O input deve ser um XML válido representando um único elemento root
 * (ex: <infNFe>...</infNFe> ou <SignedInfo>...</SignedInfo>).
 *
 * Para namespaces herdados de elementos ancestrais que não estão no
 * fragmento, passe-os em `inheritedNamespaces` (prefixo → URI).
 */
export function canonicalizeExclusive(
  xmlFragment: string,
  inheritedNamespaces: Record<string, string> = {},
): string {
  const cleaned = xmlFragment.replace(/<\?xml[^?]*\?>\s*/g, "").trim();
  const doc = new DOMParser().parseFromString(cleaned, "application/xml");
  const root = doc.documentElement as unknown as AnyNode | null;
  if (!root) throw new Error("XML fragment sem elemento root");

  const inherited = new Map<string, string>();
  for (const [k, v] of Object.entries(inheritedNamespaces)) inherited.set(k, v);
  return serializeElement(root, inherited);
}