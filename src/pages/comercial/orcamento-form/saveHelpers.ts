import { supabase } from "@/integrations/supabase/client";
import { salvarOrcamentoRpc } from "@/services/orcamentos.service";
import type { OrcamentoItem } from "@/components/Orcamento/OrcamentoItemsGrid";
import type { SalvarOrcamentoPayload, SalvarOrcamentoItemPayload } from "./types";
import { logger } from "@/lib/logger";

export interface ValidateOrcamentoResult {
  ok: boolean;
  error?: { title: string; description?: string };
  validItems: OrcamentoItem[];
}

/**
 * Validações de itens compartilhadas por handleSave/handleDuplicate:
 *  - nenhum item "_unlinked" (importado sem produto_id);
 *  - pelo menos 1 item com produto_id.
 * Retorna `validItems` já filtrado para ser mapeado ao payload.
 */
export function validateOrcamentoItems(
  items: OrcamentoItem[],
  ctx: "salvar" | "duplicar" = "salvar",
): ValidateOrcamentoResult {
  const unlinked = items.filter(
    (i) => i._unlinked || (!i.produto_id && (i.codigo_snapshot || i.descricao_snapshot)),
  );
  const verbo = ctx === "duplicar" ? "duplicar" : "salvar";
  if (unlinked.length > 0) {
    return {
      ok: false,
      validItems: [],
      error: {
        title: `Existem ${unlinked.length} item(ns) não vinculado(s).`,
        description: `Vincule ou remova os itens marcados em vermelho antes de ${verbo}.`,
      },
    };
  }
  const validItems = items.filter((i) => i.produto_id);
  if (validItems.length === 0) {
    return {
      ok: false,
      validItems: [],
      error: { title: `Adicione ao menos um item ao orçamento antes de ${verbo}.` },
    };
  }
  return { ok: true, validItems };
}

/** Mapeia `OrcamentoItem[]` (form) para o array `p_itens` da RPC `salvar_orcamento`. */
export function mapItemsToPayload(items: OrcamentoItem[]): SalvarOrcamentoItemPayload[] {
  return items.map((i) => ({
    produto_id: i.produto_id,
    codigo_snapshot: i.codigo_snapshot,
    descricao_snapshot: i.descricao_snapshot,
    variacao: i.variacao || null,
    quantidade: i.quantidade,
    unidade: i.unidade,
    valor_unitario: i.valor_unitario,
    valor_total: i.valor_total,
    peso_unitario: i.peso_unitario || 0,
    peso_total: i.peso_total || 0,
  }));
}

export interface PersistOrcamentoArgs {
  id: string | null;
  payload: SalvarOrcamentoPayload;
  itens: SalvarOrcamentoItemPayload[];
  /** Se true (criação), faz refetch do número server-side com 1 retry após 150ms. */
  fetchServerNumero: boolean;
}

export interface PersistOrcamentoResult {
  orcId: string | null;
  /** Número final (server-side se `fetchServerNumero`, senão o do payload). */
  numero: string;
}

/**
 * Persiste o orçamento via RPC e, em criação, busca o `numero` definitivo
 * (gerado por `proximo_numero_orcamento()`) com 1 retry para tolerar
 * replicação/cache do PostgREST.
 */
export async function persistOrcamento(args: PersistOrcamentoArgs): Promise<PersistOrcamentoResult> {
  const { id, payload, itens, fetchServerNumero } = args;
  const orcId = await salvarOrcamentoRpc({ id, payload, itens });
  let numero = payload.numero;
  if (fetchServerNumero && orcId) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data: row } = await supabase
        .from("orcamentos")
        .select("numero")
        .eq("id", orcId)
        .maybeSingle();
      if (row?.numero) {
        numero = row.numero;
        break;
      }
      if (attempt === 0) await new Promise((r) => setTimeout(r, 150));
    }
    if (!numero) {
      logger.warn("[OrcamentoForm] numero não retornou após salvar_orcamento", { orcId });
    }
  }
  return { orcId, numero };
}