/**
 * Entidades do módulo de Recebimento Fiscal (Etapa 8).
 * Puras — sem conhecimento de infraestrutura. Servem tanto para XMLs
 * importados manualmente quanto para os documentos recebidos via
 * Distribuição DF-e (Etapa 7).
 */
import type { Ambiente } from '../../core/types';

export type TipoDocumentoRecebido =
  | 'NFe'
  | 'NFCe'
  | 'CTe'
  | 'MDFe'
  | 'NFSe'
  | 'EventoNFe'
  | 'EventoCTe'
  | 'ProtocoloNFe'
  | 'Desconhecido';

export type OrigemRecebimento =
  | 'upload_manual'
  | 'upload_lote'
  | 'distribuicao_dfe'
  | 'email_ingest'
  | 'api_externa';

export type StatusRecebimento =
  | 'recebido'          // XML persistido, ainda não processado
  | 'em_validacao'
  | 'validado'
  | 'invalido'
  | 'duplicado'
  | 'em_conciliacao'
  | 'pendente_aprovacao'
  | 'integrado'
  | 'rejeitado'
  | 'reprocessando'
  | 'arquivado';

export interface DocumentoRecebido {
  id: string;
  empresaId: string;
  correlationId: string;
  origem: OrigemRecebimento;
  tipo: TipoDocumentoRecebido;
  chaveAcesso?: string;         // 44 dígitos (NF-e/NFC-e/CT-e/MDF-e)
  numeroDoc?: string;
  serieDoc?: string;
  cnpjEmit?: string;
  cnpjDest?: string;
  ambiente?: Ambiente;
  ufEmit?: string;
  ufDest?: string;
  dhEmi?: string;
  vTotal?: number;
  protocoloAutorizacao?: string;
  hashXml: string;              // sha-256 do conteúdo canônico (dedup)
  storageUrl?: string;          // caminho no bucket dbavizee/fiscal/recebimento
  status: StatusRecebimento;
  mensagens: MensagemProcessamento[];
  recebidoEm: string;
  atualizadoEm?: string;
  atorId?: string;
}

export interface MensagemProcessamento {
  nivel: 'info' | 'warn' | 'error';
  codigo: string;
  descricao: string;
  timestamp: string;
  contexto?: Record<string, unknown>;
}

export interface ParseResult {
  tipo: TipoDocumentoRecebido;
  chaveAcesso?: string;
  numeroDoc?: string;
  serieDoc?: string;
  cnpjEmit?: string;
  cnpjDest?: string;
  ufEmit?: string;
  ufDest?: string;
  dhEmi?: string;
  vTotal?: number;
  protocoloAutorizacao?: string;
  itens?: ItemDocumento[];
  pagamentos?: PagamentoDocumento[];
  transportador?: {
    cnpjOuCpf?: string;
    xNome?: string;
  };
}

export interface ItemDocumento {
  nItem: number;
  cProd: string;
  cEAN?: string;
  xProd: string;
  ncm?: string;
  cfop?: string;
  uCom: string;
  qCom: number;
  vUnCom: number;
  vProd: number;
  cstIcms?: string;
}

export interface PagamentoDocumento {
  tPag: string;        // código MOC (01 dinheiro, 15 boleto, etc.)
  vPag: number;
  vencimento?: string;
  parcela?: number;
}

export interface ConciliacaoResultado {
  documentoId: string;
  fornecedorId?: string;
  pedidoCompraId?: string;
  divergencias: Divergencia[];
  produtosDesconhecidos: string[];
  fornecedorDesconhecido: boolean;
  ok: boolean;
}

export interface Divergencia {
  tipo: 'valor' | 'quantidade' | 'tributo' | 'item_faltante' | 'item_excedente' | 'ncm' | 'cfop';
  itemNItem?: number;
  esperado?: string | number;
  encontrado?: string | number;
  descricao: string;
}