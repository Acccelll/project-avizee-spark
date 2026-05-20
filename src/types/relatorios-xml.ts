/**
 * Linha do relatório "XMLs Arquivados" — derivada de notas_fiscais com
 * informações mínimas necessárias para listar, filtrar e exportar o .zip.
 */
export interface XmlArquivadoRow {
  notaFiscalId: string;
  tipo: "entrada" | "saida" | string;
  numero: string;
  serie: string;
  chave: string;
  emissao: string | null;
  parceiro: string;
  fornecedorId?: string;
  clienteId?: string;
  valor: number;
  status: string;
  caminhoXml: string | null;
  temXml: "sim" | "nao";
}