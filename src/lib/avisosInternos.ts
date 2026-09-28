import type { AvisoInternoItem } from "@/services/produtos.service";

export interface GrupoAvisoInterno {
  aviso: string;
  itens: Array<{ produtoId: string; rotulo: string }>;
}

/** Agrupa os itens por texto de aviso (vários grupos de produto podem pedir o mesmo). */
export function agruparAvisosInternos(avisos: AvisoInternoItem[]): GrupoAvisoInterno[] {
  const porAviso = new Map<string, GrupoAvisoInterno>();
  for (const a of avisos) {
    const chave = a.aviso.toLocaleLowerCase("pt-BR");
    if (!porAviso.has(chave)) porAviso.set(chave, { aviso: a.aviso, itens: [] });
    const g = porAviso.get(chave)!;
    if (!g.itens.some((i) => i.produtoId === a.produtoId)) {
      g.itens.push({ produtoId: a.produtoId, rotulo: a.codigo ? `${a.codigo} – ${a.nome}` : a.nome });
    }
  }
  return [...porAviso.values()];
}
