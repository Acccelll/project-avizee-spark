import type { Tables } from "@/integrations/supabase/types";
import type { OrcamentoItem } from "@/components/Orcamento/OrcamentoItemsGrid";
import {
  aplicarPrecosEspeciaisEmLote,
  type RegraPrecoEspecial,
} from "@/lib/precos-especiais";
import { type ClienteSnapshot } from "./types";

/** Mapeia uma linha de `clientes` para o snapshot embutido no orçamento. */
export function mapClienteToSnapshot(c: Tables<"clientes">): ClienteSnapshot {
  return {
    nome_razao_social: c.nome_razao_social || "",
    nome_fantasia: c.nome_fantasia || "",
    cpf_cnpj: c.cpf_cnpj || "",
    inscricao_estadual: c.inscricao_estadual || "",
    email: c.email || "",
    telefone: c.telefone || "",
    celular: c.celular || "",
    contato: c.contato || "",
    logradouro: c.logradouro || "",
    numero: c.numero || "",
    bairro: c.bairro || "",
    cidade: c.cidade || "",
    uf: c.uf || "",
    cep: c.cep || "",
    codigo: c.id?.substring(0, 6) || "",
  };
}

/**
 * Recalcula valores de itens aplicando regras de preço especial do cliente.
 * Retorna `{ items, changedCount }`; `items` é a mesma referência se nada mudou.
 */
export function recalcItemsWithSpecialPrices(
  items: OrcamentoItem[],
  rules: RegraPrecoEspecial[],
  now: Date = new Date(),
): { items: OrcamentoItem[]; changedCount: number } {
  if (items.length === 0) return { items, changedCount: 0 };
  const itensCompat = items
    .filter((it) => it.produto_id)
    .map((it) => ({
      produto_id: it.produto_id as string,
      valor_unitario: it.valor_unitario,
      quantidade: it.quantidade,
    }));
  const { alterados } = aplicarPrecosEspeciaisEmLote(itensCompat, rules, now);
  if (alterados.length === 0) return { items, changedCount: 0 };
  const alteradosSet = new Set(alterados);
  const next = items.map((item) => {
    if (!item.produto_id || !alteradosSet.has(item.produto_id)) return item;
    const regra = rules.find((r) => r.produto_id === item.produto_id);
    const novoPreco = regra?.preco_especial ? Number(regra.preco_especial) : item.valor_unitario;
    return {
      ...item,
      valor_unitario: novoPreco,
      valor_total: Math.round(item.quantidade * novoPreco * 100) / 100,
    };
  });
  return { items: next, changedCount: alterados.length };
}