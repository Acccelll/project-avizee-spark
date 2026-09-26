/**
 * Referências de pedido lidas do XML da NF-e de saída.
 *
 * O Sebrae grava o número do pedido do cliente no item (`prod/xPed`) e,
 * quase sempre, também nas informações complementares ("PEDIDO: 4500114274;",
 * "PEDIDOS: 4500112984, 4500113048", "OC: 3731", "PC: 045900"). Quando o
 * cliente não manda número, vai o do orçamento ("ORC100291", "ORC. 100160").
 * O banco compara sem pontuação nem zeros à esquerda (`normalizar_pedido`).
 */

import type { NFeData } from "@/lib/nfeXmlParser";

const ORCAMENTO_RE = /\bORC\.?\s*(?:N[º°O]\.?\s*)?(\d{5,})/gi;
const PEDIDO_RE = /\b(?:PEDIDOS?(?:\s+DE\s+COMPRA)?|PED\.|O\.C\.|OC|PC)\s*(?:N[º°O]\.?\s*)?[:#-]?\s*/gi;
// Números logo depois da palavra-chave: "4500112735, 4500112897; 4500112736".
const LISTA_NUMEROS_RE = /^(?:\d[\d./-]*\d|\d)(?:\s*(?:[,;/]|\be\b)\s*(?:\d[\d./-]*\d|\d))*/i;

export function extrairReferenciasDoTexto(texto: string | null | undefined): string[] {
  if (!texto) return [];
  const refs: string[] = [];
  for (const m of texto.matchAll(ORCAMENTO_RE)) refs.push(`ORC${m[1]}`);
  for (const m of texto.matchAll(PEDIDO_RE)) {
    const resto = texto.slice((m.index ?? 0) + m[0].length);
    const lista = LISTA_NUMEROS_RE.exec(resto);
    if (!lista) continue;
    for (const n of lista[0].split(/\s*(?:[,;]|\be\b)\s*/i)) {
      if (n.trim()) refs.push(n.trim());
    }
  }
  return refs;
}

export function extrairReferenciasPedido(
  nfe: Pick<NFeData, "itens" | "informacoesComplementares">,
): string[] {
  const refs = [
    ...nfe.itens.map((i) => i.pedido?.trim()).filter((p): p is string => !!p),
    ...extrairReferenciasDoTexto(nfe.informacoesComplementares),
  ];
  return [...new Set(refs)];
}
