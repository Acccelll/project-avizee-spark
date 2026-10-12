/**
 * Workbook de Fechamento (modelo v2): 12 abas com a identidade da AviZee,
 * preenchidas com os mesmos dados da apresentação (`apresentacao_fechamento_dados`).
 */
import type { ApresentacaoFechamentoDados } from '@/lib/apresentacao/fechamento/tipos';
import { MODELO_V2_URL } from './layout';
import { preencherWorkbookFechamentoV2 } from './preencher';

export async function gerarWorkbookFechamentoV2(dados: ApresentacaoFechamentoDados, signal?: AbortSignal): Promise<Blob> {
  const resposta = await fetch(MODELO_V2_URL, { signal });
  if (!resposta.ok) {
    throw new Error(`Modelo do Workbook de Fechamento não encontrado (${MODELO_V2_URL}, HTTP ${resposta.status}).`);
  }
  const modelo = await resposta.arrayBuffer();
  signal?.throwIfAborted?.();
  return (await preencherWorkbookFechamentoV2(modelo, dados, { tipo: 'blob' })) as Blob;
}

export { nomeArquivoWorkbook } from './nome';
