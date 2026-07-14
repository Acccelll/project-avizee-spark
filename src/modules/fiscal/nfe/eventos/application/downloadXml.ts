/**
 * Download e armazenamento do XML autorizado (procNFe). Idempotente:
 * se já houver XML persistido, devolve o existente.
 */
import type { IXmlStorage } from './contracts';
import type { Result } from '../../../core/types';
import { ok, fail } from '../../../core/types';
import { makeError, FISCAL_ERROR_CODES } from '../../../core/errors';
import type { FiscalEventBus } from '../../../infrastructure/events/eventBus';

export interface DownloadXmlInput {
  empresaId: string;
  correlationId: string;
  chaveAcesso: string;
  fetchProcXml?: () => Promise<string>;
}

export class DownloadXmlUseCase {
  constructor(private deps: { storage: IXmlStorage; events: FiscalEventBus }) {}

  async execute(input: DownloadXmlInput): Promise<Result<{ url: string; xml: string }>> {
    const existente = await this.deps.storage.getAutorizado(input.chaveAcesso);
    if (existente) {
      return ok({ url: 'stored://' + input.chaveAcesso, xml: existente });
    }
    if (!input.fetchProcXml) {
      return fail(makeError(FISCAL_ERROR_CODES.INTERNAL, 'XML não armazenado e nenhum fetcher fornecido'));
    }
    const xml = await input.fetchProcXml();
    if (!xml || !xml.includes('<nfeProc') && !xml.includes('<NFe')) {
      return fail(makeError(FISCAL_ERROR_CODES.XML_PARSE, 'conteúdo baixado não parece um procNFe/NFe'));
    }
    const url = await this.deps.storage.putAutorizado(input.chaveAcesso, xml);
    await this.deps.events.emit('fiscal.nfe.xml.baixado', {
      correlationId: input.correlationId, empresaId: input.empresaId, chave: input.chaveAcesso,
    });
    return ok({ url, xml });
  }
}