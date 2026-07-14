/**
 * Importação em lote de XMLs. Processa com concorrência controlada,
 * emite eventos de progresso e tolera falhas individuais.
 * Retorna resumo agregado — cada item traz o `Result` do use case.
 */
import type { Result } from '../../core/types';
import { ok } from '../../core/types';
import type { FiscalEventBus } from '../../infrastructure/events/eventBus';
import { ImportarXmlUseCase, type ImportarXmlSaida } from './importarXml';
import type { OrigemRecebimento } from '../domain/entities';

export interface ImportarLoteItem {
  nome: string;
  xml: string;
}

export interface ImportarLoteInput {
  empresaId: string;
  cnpjEmpresa: string;
  correlationId: string;
  origem: OrigemRecebimento;
  itens: ImportarLoteItem[];
  concorrencia?: number;
  ambientePermitido?: 1 | 2;
  atorId?: string;
}

export interface ImportarLoteItemSaida {
  nome: string;
  resultado: Result<ImportarXmlSaida>;
}

export interface ImportarLoteSaida {
  total: number;
  sucesso: number;
  duplicados: number;
  falhas: number;
  itens: ImportarLoteItemSaida[];
}

export class ImportarLoteUseCase {
  constructor(private deps: {
    importar: ImportarXmlUseCase;
    events: FiscalEventBus;
  }) {}

  async execute(input: ImportarLoteInput): Promise<Result<ImportarLoteSaida>> {
    const concorrencia = Math.max(1, Math.min(input.concorrencia ?? 4, 16));
    const total = input.itens.length;

    await this.deps.events.emit('fiscal.recebimento.lote.iniciado', {
      correlationId: input.correlationId, empresaId: input.empresaId, total,
    });

    const itens: ImportarLoteItemSaida[] = new Array(total);
    let sucesso = 0;
    let duplicados = 0;
    let falhas = 0;
    let cursor = 0;
    let processados = 0;

    const workers = Array.from({ length: concorrencia }, async () => {
      while (cursor < total) {
        const idx = cursor++;
        const item = input.itens[idx];
        const r = await this.deps.importar.execute({
          empresaId: input.empresaId,
          cnpjEmpresa: input.cnpjEmpresa,
          correlationId: `${input.correlationId}#${idx}`,
          origem: input.origem,
          xml: item.xml,
          ambientePermitido: input.ambientePermitido,
          atorId: input.atorId,
        });
        itens[idx] = { nome: item.nome, resultado: r };
        if (r.ok) {
          if (r.data!.duplicado) duplicados++;
          else sucesso++;
        } else {
          falhas++;
        }
        processados++;
        if (processados % 25 === 0 || processados === total) {
          await this.deps.events.emit('fiscal.recebimento.lote.progresso', {
            correlationId: input.correlationId, empresaId: input.empresaId,
            total, processados, falhas,
          });
        }
      }
    });
    await Promise.all(workers);

    await this.deps.events.emit('fiscal.recebimento.lote.finalizado', {
      correlationId: input.correlationId, empresaId: input.empresaId,
      total, processados, falhas,
    });

    return ok({ total, sucesso, duplicados, falhas, itens });
  }
}