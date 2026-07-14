/**
 * Importa 1 XML fiscal recebido. Fluxo:
 *   parse → hash → dedup → validar → persistir (Storage + repo) → emitir.
 * Idempotente por `hashXml`; documento duplicado retorna o existente
 * sem regravar Storage.
 */
import type { Result } from '../../core/types';
import { ok, fail } from '../../core/types';
import { makeError, FISCAL_ERROR_CODES } from '../../core/errors';
import type { FiscalEventBus } from '../../infrastructure/events/eventBus';
import type {
  IDocumentoRecebidoRepository,
  IRecebimentoStorage,
  IRecebimentoAuditoria,
} from './contracts';
import type { DocumentoRecebido, OrigemRecebimento } from '../domain/entities';
import { parseUniversal } from '../infrastructure/parser/universalParser';
import { computeXmlHash } from '../infrastructure/hash/xmlHash';
import { validarDocumentoRecebido } from '../domain/validation';
import { transition } from '../domain/stateMachine';

export interface ImportarXmlInput {
  empresaId: string;
  cnpjEmpresa: string;
  correlationId: string;
  origem: OrigemRecebimento;
  xml: string;
  ambientePermitido?: 1 | 2;
  atorId?: string;
}

export interface ImportarXmlSaida {
  documento: DocumentoRecebido;
  duplicado: boolean;
}

export class ImportarXmlUseCase {
  constructor(private deps: {
    repository: IDocumentoRecebidoRepository;
    storage: IRecebimentoStorage;
    auditoria: IRecebimentoAuditoria;
    events: FiscalEventBus;
  }) {}

  async execute(input: ImportarXmlInput): Promise<Result<ImportarXmlSaida>> {
    const parsed = parseUniversal(input.xml);
    if (!parsed.ok) return fail(parsed.error!);

    const hash = await computeXmlHash(input.xml);

    const existentePorHash = await this.deps.repository.getByHash(input.empresaId, hash);
    if (existentePorHash) {
      await this.deps.events.emit('fiscal.recebimento.xml.duplicado', {
        correlationId: input.correlationId, empresaId: input.empresaId,
        documentoRecebidoId: existentePorHash.id, hash, chave: existentePorHash.chaveAcesso,
      });
      return ok({ documento: existentePorHash, duplicado: true });
    }
    if (parsed.data!.chaveAcesso) {
      const existentePorChave = await this.deps.repository.getByChave(
        input.empresaId, parsed.data!.chaveAcesso,
      );
      if (existentePorChave) {
        await this.deps.events.emit('fiscal.recebimento.xml.duplicado', {
          correlationId: input.correlationId, empresaId: input.empresaId,
          documentoRecebidoId: existentePorChave.id, chave: parsed.data!.chaveAcesso,
        });
        return ok({ documento: existentePorChave, duplicado: true });
      }
    }

    const val = validarDocumentoRecebido(parsed.data!, {
      cnpjEmpresa: input.cnpjEmpresa,
      ambientePermitido: input.ambientePermitido,
    });

    const chaveOuHash = parsed.data!.chaveAcesso ?? hash;
    const storageUrl = await this.deps.storage.putOriginal(
      input.empresaId, chaveOuHash, input.xml,
    );

    const doc: DocumentoRecebido = {
      id: crypto.randomUUID(),
      empresaId: input.empresaId,
      correlationId: input.correlationId,
      origem: input.origem,
      tipo: parsed.data!.tipo,
      chaveAcesso: parsed.data!.chaveAcesso,
      numeroDoc: parsed.data!.numeroDoc,
      serieDoc: parsed.data!.serieDoc,
      cnpjEmit: parsed.data!.cnpjEmit,
      cnpjDest: parsed.data!.cnpjDest,
      ufEmit: parsed.data!.ufEmit,
      ufDest: parsed.data!.ufDest,
      dhEmi: parsed.data!.dhEmi,
      vTotal: parsed.data!.vTotal,
      protocoloAutorizacao: parsed.data!.protocoloAutorizacao,
      hashXml: hash,
      storageUrl,
      status: val.ok ? 'validado' : 'invalido',
      mensagens: val.ok
        ? []
        : [{
            nivel: 'error',
            codigo: val.error!.code,
            descricao: val.error!.message,
            timestamp: new Date().toISOString(),
          }],
      recebidoEm: new Date().toISOString(),
      atorId: input.atorId,
    };

    // recebido → (em_validacao) → validado/invalido
    const t1 = transition('recebido', 'em_validacao');
    if (!t1.ok) return fail(t1.error!);
    const t2 = transition('em_validacao', doc.status);
    if (!t2.ok) return fail(t2.error!);

    await this.deps.repository.save(doc);
    await this.deps.auditoria.registrar({
      empresaId: input.empresaId,
      documentoRecebidoId: doc.id,
      correlationId: input.correlationId,
      operacao: 'recebimento.importado',
      ator: input.atorId,
      payload: { tipo: doc.tipo, chave: doc.chaveAcesso, origem: input.origem, hash },
    });
    await this.deps.events.emit('fiscal.recebimento.xml.recebido', {
      correlationId: input.correlationId, empresaId: input.empresaId,
      documentoRecebidoId: doc.id, chave: doc.chaveAcesso, hash, origem: input.origem,
    });
    await this.deps.events.emit(
      val.ok ? 'fiscal.recebimento.xml.validado' : 'fiscal.recebimento.xml.invalido',
      {
        correlationId: input.correlationId, empresaId: input.empresaId,
        documentoRecebidoId: doc.id, chave: doc.chaveAcesso,
      },
    );
    if (!val.ok) {
      return fail(makeError(FISCAL_ERROR_CODES.INTERNAL, val.error!.message));
    }
    return ok({ documento: doc, duplicado: false });
  }
}