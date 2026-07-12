/**
 * Busca candidatos ERP para uma transação de extrato e devolve os
 * top-N por score de matching. Fase 2 do Motor Inteligente.
 *
 * Não persiste sugestões — o chamador decide (UI de conciliação ou
 * job em lote que grava `sugestao_score` / `sugestao_lancamento_id`).
 */
import { supabase } from "@/integrations/supabase/client";
import { scoreMatch, type ExtratoInput, type CandidatoInput, type MatchScore } from "./scoreMatch";

export interface CandidatoScored extends MatchScore {
  lancamento_id: string;
  tipo: CandidatoInput["tipo"];
  valor: number;
  data_vencimento: string;
}

export interface BuscarCandidatosParams {
  empresa_id: string;
  extrato: ExtratoInput;
  janelaDias?: number;   // padrão 10
  minScore?: number;     // padrão 0.5
  topN?: number;         // padrão 5
}

function addDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export async function buscarCandidatos({
  empresa_id,
  extrato,
  janelaDias = 10,
  minScore = 0.5,
  topN = 5,
}: BuscarCandidatosParams): Promise<CandidatoScored[]> {
  const tipoEsperado = extrato.valor >= 0 ? "receber" : "pagar";
  const dataMin = addDias(extrato.data, -janelaDias);
  const dataMax = addDias(extrato.data, janelaDias);
  const valorAbs = Math.abs(extrato.valor);

  const { data, error } = await supabase
    .from("financeiro_lancamentos")
    .select(
      "id, tipo, valor, data_vencimento, forma_pagamento, titulo, origem_tipo, " +
        "fornecedor:fornecedores(nome_fantasia, razao_social, cpf_cnpj), " +
        "cliente:clientes(nome_fantasia, razao_social, cpf_cnpj)",
    )
    .eq("empresa_id", empresa_id)
    .eq("tipo", tipoEsperado)
    .eq("ativo", true)
    .is("data_pagamento", null)
    .is("cartao_fatura_id", null)
    .gte("data_vencimento", dataMin)
    .lte("data_vencimento", dataMax)
    .gte("valor", valorAbs - 5)
    .lte("valor", valorAbs + 5)
    .limit(200);

  if (error) throw new Error(error.message);

  // Exclui lançamentos já vinculados a linhas de fatura de cartão
  const ids = (data ?? []).map((r) => (r as { id: string }).id);
  let excluir = new Set<string>();
  if (ids.length) {
    const { data: linhas } = await supabase
      .from("cartao_fatura_lancamentos")
      .select("lancamento_id")
      .in("lancamento_id", ids)
      .not("lancamento_id", "is", null);
    excluir = new Set(
      (linhas ?? [])
        .map((r) => (r as { lancamento_id: string | null }).lancamento_id)
        .filter((x): x is string => !!x),
    );
  }
  const filtered = (data ?? []).filter((r) => !excluir.has((r as { id: string }).id));

  type Row = {
    id: string;
    tipo: "pagar" | "receber";
    valor: number;
    data_vencimento: string;
    forma_pagamento: string | null;
    titulo: string | null;
    origem_tipo: string | null;
    fornecedor: { nome_fantasia?: string; razao_social?: string; cpf_cnpj?: string } | null;
    cliente: { nome_fantasia?: string; razao_social?: string; cpf_cnpj?: string } | null;
  };

  const scored: CandidatoScored[] = (filtered as unknown as Row[]).map((r) => {
    const cand: CandidatoInput = {
      id: r.id,
      tipo: r.tipo,
      valor: Number(r.valor),
      data_vencimento: r.data_vencimento,
      forma_pagamento: r.forma_pagamento,
      titulo: r.titulo,
      origem_tipo: r.origem_tipo,
      fornecedor_nome: r.fornecedor?.nome_fantasia ?? r.fornecedor?.razao_social ?? null,
      fornecedor_documento: r.fornecedor?.cpf_cnpj ?? null,
      cliente_nome: r.cliente?.nome_fantasia ?? r.cliente?.razao_social ?? null,
      cliente_documento: r.cliente?.cpf_cnpj ?? null,
    };
    const s = scoreMatch(extrato, cand);
    return {
      lancamento_id: r.id,
      tipo: r.tipo,
      valor: cand.valor,
      data_vencimento: r.data_vencimento,
      score: s.score,
      motivos: s.motivos,
    };
  });

  return scored
    .filter((c) => c.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}