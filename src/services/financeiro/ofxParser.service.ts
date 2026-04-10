/**
 * Serviço de parse de arquivos OFX/QFX para extrato bancário.
 *
 * Encapsula o parser OFX de baixo nível (`@/lib/parseOFX`) expondo uma
 * interface tipada para upload de arquivos diretamente do browser.
 */

import { parseOFX as parseOFXText } from "@/lib/parseOFX";

/**
 * Representa uma transação extraída de um extrato bancário OFX.
 * Campo `tipo`: "C" = crédito (entrada), "D" = débito (saída).
 */
export interface TransacaoExtrato {
  id: string;
  data: string; // ISO 8601 "YYYY-MM-DD"
  descricao: string;
  valor: number;
  tipo: "C" | "D"; // Crédito ou Débito
}

/**
 * Faz o parse de um arquivo OFX/QFX enviado pelo usuário e retorna as
 * transações tipadas.
 *
 * O tipo da transação é inferido pelo sinal do valor:
 * - Valor positivo → Crédito ("C") — entrada de dinheiro.
 * - Valor negativo → Débito ("D") — saída de dinheiro.
 *
 * @param file  Arquivo OFX/QFX selecionado pelo usuário.
 * @returns     Array de transações do extrato.
 * @throws      Erro se o arquivo não puder ser lido ou não contiver transações.
 */
export async function parseOFX(file: File): Promise<TransacaoExtrato[]> {
  const text = await file.text();
  const transacoes = parseOFXText(text);

  if (transacoes.length === 0) {
    throw new Error("Nenhuma transação encontrada no arquivo OFX.");
  }

  return transacoes.map((t) => ({
    id: t.id,
    data: t.data,
    descricao: t.descricao,
    valor: Math.abs(t.valor),
    tipo: t.valor >= 0 ? "C" : "D",
  }));
}
