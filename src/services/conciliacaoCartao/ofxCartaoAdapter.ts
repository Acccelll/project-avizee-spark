/**
 * Adapter OFX para faturas de cartão de crédito (Item 5 do backlog de
 * Conciliação de Cartão). Reaproveita `parseOFX` — o parser já entende
 * `<CCSTMTRS>` — e monta um `FaturaImportInput` para a mesma RPC
 * `cartao_importar_fatura` usada pelos parsers de PDF.
 *
 * Convenção: em OFX de cartão brasileiro, débitos (despesas) vêm com
 * valor negativo e créditos (pagamento/estorno) positivos. O modelo
 * interno guarda despesas como positivas, então invertemos o sinal.
 */
import { parseOFX, readOFXFileText } from "@/lib/parseOFX";
import type { FaturaImportInput } from "./types";

export function isOFXFaturaCartao(text: string): boolean {
  return /<\s*(?:[A-Z0-9_]+:)?CCSTMTRS\s*>/i.test(text);
}

function competenciaDoRange(datas: string[]): string {
  const ord = [...datas].sort();
  const [y, m] = (ord[ord.length - 1] ?? new Date().toISOString().slice(0, 10)).split("-");
  return `${y}-${m}`;
}

export async function parseOFXFaturaCartao(file: File): Promise<FaturaImportInput> {
  const texto = await readOFXFileText(file);
  if (!isOFXFaturaCartao(texto)) {
    throw new Error("Arquivo OFX não é de cartão (bloco CCSTMTRS ausente).");
  }
  const txs = parseOFX(texto);
  if (txs.length === 0) throw new Error("Nenhuma transação encontrada no OFX.");

  const lancamentos = txs.map((t) => ({
    data_compra: t.data,
    descricao: t.descricao || "(sem descrição)",
    // OFX: débito negativo → despesa positiva; crédito positivo → estorno negativo.
    valor: -t.valor,
  }));

  const datas = txs.map((t) => t.data);
  const competencia = competenciaDoRange(datas);
  const dataVenc = datas.sort()[datas.length - 1];
  const valorTotal = lancamentos.reduce((s, l) => s + l.valor, 0);

  return {
    emissor: "inter", // rótulo neutro — RPC usa `p_origem` para diferenciar
    competencia,
    data_vencimento: dataVenc,
    data_fechamento: dataVenc,
    valor_total: Number(valorTotal.toFixed(2)),
    lancamentos,
  };
}