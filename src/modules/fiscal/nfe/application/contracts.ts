import type { NFe, NFeStatus } from '../domain/entities';

/**
 * Porta de persistência da NF-e. A implementação concreta (Etapa 6.x)
 * mapeará para `notas_fiscais`/`nota_fiscal_eventos`. Mantemos o contrato
 * mínimo — o legado (`src/services/fiscal/*`) continua ativo em paralelo
 * (strangler, ADR-016).
 */
export interface INFeRepository {
  save(nfe: NFe): Promise<void>;
  updateStatus(id: string, status: NFeStatus, patch?: Partial<NFe>): Promise<void>;
  getById(id: string): Promise<NFe | null>;
  getByChave(chave: string): Promise<NFe | null>;
}

export interface INFeXmlStorage {
  putEnviado(chave: string, xml: string): Promise<string>;
  putAutorizado(chave: string, xmlProc: string): Promise<string>;
}