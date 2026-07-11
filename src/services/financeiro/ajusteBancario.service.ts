/**
 * Sprint 3 — Gera um lançamento de "ajuste bancário" para zerar uma
 * pequena divergência entre extrato e lançamento(s) ERP. Reaproveita
 * `criarLancamentoInlineDoExtrato`, que cria o lançamento + baixa
 * usando a RPC padrão de baixa.
 */
import { criarLancamentoInlineDoExtrato } from "./criarLancamentoInline.service";

export async function gerarLancamentoAjusteBancario(input: {
  empresa_id: string;
  conta_bancaria_id: string;
  data: string;
  diferenca: number; // positivo → sobra no extrato (receita); negativo → falta (despesa)
  descricao?: string;
}): Promise<{ lancamento_id: string; baixa_id: string }> {
  const desc = input.descricao ?? `Ajuste bancário — diferença de conciliação`;
  const res = await criarLancamentoInlineDoExtrato({
    empresa_id: input.empresa_id,
    conta_bancaria_id: input.conta_bancaria_id,
    extrato: {
      id: `ajuste-${Date.now()}`,
      data: input.data,
      descricao: desc,
      valor: input.diferenca,
      tipo: input.diferenca >= 0 ? "C" : "D",
    },
    descricao: desc,
  });
  return { lancamento_id: res.lancamento_id, baixa_id: res.baixa_id };
}