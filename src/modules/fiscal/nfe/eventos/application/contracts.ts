/**
 * Portas de persistência dos eventos fiscais, inutilizações, distribuição
 * DF-e e armazenamento de XML. Implementações concretas ficam por conta
 * das adaptações Supabase — o núcleo permanece agnóstico.
 */
import type {
  DistDFeDocumento,
  DistDFeState,
  EventoFiscal,
  EventoStatus,
  InutilizacaoNumeracao,
} from '../domain/entities';

export interface IEventoRepository {
  save(ev: EventoFiscal): Promise<void>;
  updateStatus(id: string, status: EventoStatus, patch?: Partial<EventoFiscal>): Promise<void>;
  listByChave(chave: string): Promise<EventoFiscal[]>;
  countCartaCorrecao(chave: string): Promise<number>;
}

export interface IInutilizacaoRepository {
  save(inu: InutilizacaoNumeracao): Promise<void>;
  updateStatus(
    id: string,
    status: InutilizacaoNumeracao['status'],
    patch?: Partial<InutilizacaoNumeracao>,
  ): Promise<void>;
  existsFaixa(cnpj: string, serie: number, nIni: number, nFin: number): Promise<boolean>;
}

export interface IDistDFeStateRepository {
  get(empresaId: string, cnpj: string): Promise<DistDFeState | null>;
  upsert(state: DistDFeState): Promise<void>;
  appendDocumentos(empresaId: string, docs: DistDFeDocumento[]): Promise<void>;
}

export interface IXmlStorage {
  putAutorizado(chave: string, xmlProc: string): Promise<string>;
  putEvento(chave: string, id: string, xml: string): Promise<string>;
  putDistDFe(chave: string, nsu: string, xmlBase64: string): Promise<string>;
  getAutorizado(chave: string): Promise<string | null>;
}