/**
 * Sincronização de status entre banco e SEFAZ para documentos pendentes.
 * Executa consultas de protocolo em lote e delega a transição para o
 * repositório da NF-e, respeitando a máquina de estados.
 */
import type { Result, Ambiente, UF } from '../../../core/types';
import { ok } from '../../../core/types';
import type { INFeRepository } from '../../application/contracts';
import type { FiscalEventBus } from '../../../infrastructure/events/eventBus';
import { ConsultNFeUseCase } from '../../application/consultUseCase';
import type { NFe, NFeStatus } from '../../domain/entities';
import { canTransition } from '../../domain/stateMachine';

export interface SincronizarInput {
  empresaId: string;
  correlationId: string;
  pendentes: Array<Pick<NFe, 'id' | 'chaveAcesso' | 'status' | 'emitente'> & { ambiente: Ambiente; uf: UF }>;
}

export interface SincronizarSaida {
  processados: number;
  atualizados: number;
}

const CSTAT_TO_STATUS: Record<string, NFeStatus> = {
  '100': 'autorizada',
  '150': 'autorizada',
  '101': 'cancelada',
  '110': 'denegada',
  '301': 'denegada',
  '302': 'denegada',
  '303': 'denegada',
};

export class SincronizarStatusUseCase {
  constructor(private deps: {
    nfeRepository: INFeRepository;
    consulta: ConsultNFeUseCase;
    events: FiscalEventBus;
  }) {}

  async execute(input: SincronizarInput): Promise<Result<SincronizarSaida>> {
    let atualizados = 0;
    for (const item of input.pendentes) {
      if (!item.chaveAcesso) continue;
      const r = await this.deps.consulta.execute({
        chave: item.chaveAcesso,
        uf: item.uf,
        ambiente: item.ambiente,
        empresaId: input.empresaId,
        correlationId: input.correlationId,
      });
      if (!r.ok) continue;
      const novo = CSTAT_TO_STATUS[r.data!.cstat];
      if (novo && novo !== item.status && canTransition(item.status, novo)) {
        await this.deps.nfeRepository.updateStatus(item.id, novo, { protocolo: r.data!.protocolo });
        atualizados++;
        await this.deps.events.emit('fiscal.nfe.status.sincronizado', {
          correlationId: input.correlationId, empresaId: input.empresaId,
          chave: item.chaveAcesso, cstat: r.data!.cstat, xmotivo: r.data!.xmotivo,
        });
      }
    }
    return ok({ processados: input.pendentes.length, atualizados });
  }
}