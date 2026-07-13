/**
 * Fase 3 — Conciliação de Cartão: gera uma linha de "ajuste" em
 * `cartao_fatura_lancamentos` para zerar a diferença entre o valor total
 * da fatura e a soma das linhas importadas. Análogo funcional ao
 * `gerarLancamentoAjusteBancario` da conciliação bancária, mas no
 * escopo do documento fatura (não gera baixa — o usuário concilia depois
 * como qualquer outra linha).
 */
import { supabase } from "@/integrations/supabase/client";

export interface GerarAjusteFaturaInput {
  cartao_fatura_id: string;
  empresa_id: string;
  diferenca: number; // valor_total da fatura − Σ(linhas)
  data: string; // referência (data_fechamento ou hoje)
  descricao?: string;
}

export async function gerarAjusteFatura(input: GerarAjusteFaturaInput): Promise<{ id: string }> {
  if (Math.abs(input.diferenca) < 0.005) {
    throw new Error("Sem diferença para ajustar.");
  }
  const desc = input.descricao ?? "Ajuste de fatura — divergência de conciliação";
  const hash = `ajuste:${input.cartao_fatura_id}:${Date.now()}`;
  const { data, error } = await supabase
    .from("cartao_fatura_lancamentos")
    .insert({
      cartao_fatura_id: input.cartao_fatura_id,
      empresa_id: input.empresa_id,
      data_compra: input.data,
      descricao: desc,
      valor: input.diferenca,
      hash,
      status: "pendente",
    } as never)
    .select("id")
    .single();
  if (error) throw error;
  return { id: (data as { id: string }).id };
}