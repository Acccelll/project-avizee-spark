/**
 * Cancelamento da NF-e (evento 110111). Regras: janela de 24h após
 * autorização, nSeqEvento=1, protocolo original obrigatório.
 */
import type { IEndpointRegistry, IAuditoriaRepository } from '../../../application/contracts';
import type { ISignatureEngine } from '../../../infrastructure/signature/signatureEngine';
import type { SoapClient } from '../../../infrastructure/soap/soapClient';
import type { FiscalEventBus } from '../../../infrastructure/events/eventBus';
import type { INFeRepository } from '../../application/contracts';
import type { IEventoRepository } from './contracts';
import type { EventoFiscal } from '../domain/entities';
import type { Ambiente, UF, Result } from '../../../core/types';
import { ok, fail } from '../../../core/types';
import { TIPO_EVENTO } from '../domain/entities';
import { validarCancelamento } from '../domain/rules';
import { buildEventoXml, buildEnvEvento } from '../infrastructure/eventoXmlBuilder';
import { transition } from '../../domain/stateMachine';
import { assinarEEnviar, CSTAT_HOMOLOGADO_EVENTO } from './_shared';

export interface CancelarNFeInput {
  empresaId: string;
  correlationId: string;
  chaveAcesso: string;
  cnpjEmit: string;
  protocoloAutorizacao: string;
  justificativa: string;
  uf: UF;
  cUF: string;
  ambiente: Ambiente;
  dhAutorizacao?: string;
}

export class CancelarNFeUseCase {
  constructor(private deps: {
    nfeRepository: INFeRepository;
    eventoRepository: IEventoRepository;
    signature: ISignatureEngine;
    endpoints: IEndpointRegistry;
    soap: SoapClient;
    auditoria: IAuditoriaRepository;
    events: FiscalEventBus;
  }) {}

  async execute(input: CancelarNFeInput): Promise<Result<EventoFiscal>> {
    const evento: EventoFiscal = {
      id: crypto.randomUUID(),
      empresaId: input.empresaId,
      chaveAcesso: input.chaveAcesso,
      tipoEvento: TIPO_EVENTO.CANCELAMENTO,
      nSeqEvento: 1,
      cnpjOrgao: input.cnpjEmit,
      dhEvento: new Date().toISOString(),
      detEvento: { nProt: input.protocoloAutorizacao, xJust: input.justificativa },
      status: 'pendente',
      correlationId: input.correlationId,
    };
    const rn = validarCancelamento(evento, input.dhAutorizacao);
    if (!rn.ok) return fail(rn.error!);

    await this.deps.eventoRepository.save(evento);
    await this.deps.events.emit('fiscal.nfe.cancelamento.solicitado', {
      correlationId: input.correlationId,
      empresaId: input.empresaId,
      chave: input.chaveAcesso,
      tipoEvento: TIPO_EVENTO.CANCELAMENTO,
    });

    const { xml } = buildEventoXml(evento, { cOrgao: input.cUF, ambiente: input.ambiente });
    const r = await assinarEEnviar(this.deps, {
      empresaId: input.empresaId,
      correlationId: input.correlationId,
      xml,
      elementLocalName: 'infEvento',
      documento: 'NFe',
      servico: 'recepcaoEvento',
      uf: input.uf,
      ambiente: input.ambiente,
      soapAction: 'nfeRecepcaoEvento',
      dataElementName: 'nfeDadosMsg',
      breakerSufixo: 'evento',
      operacaoAuditoria: 'nfe.evento.cancelamento',
      chaveAcesso: input.chaveAcesso,
      envelopeBuilder: (assinado) => buildEnvEvento([assinado]),
    });
    if (!r.ok) {
      await this.deps.eventoRepository.updateStatus(evento.id, 'rejeitado', {
        xmotivo: r.error!.message,
      });
      await this.deps.events.emit('fiscal.nfe.cancelamento.rejeitado', {
        correlationId: input.correlationId, empresaId: input.empresaId, chave: input.chaveAcesso,
        xmotivo: r.error!.message,
      });
      return fail(r.error!);
    }

    const homologado = CSTAT_HOMOLOGADO_EVENTO.has(r.data!.cstat);
    const status = homologado ? 'homologado' : 'rejeitado';
    const patch = { protocolo: r.data!.protocolo, cstat: r.data!.cstat, xmotivo: r.data!.xmotivo };
    await this.deps.eventoRepository.updateStatus(evento.id, status, patch);

    if (homologado) {
      const nfe = await this.deps.nfeRepository.getByChave(input.chaveAcesso);
      if (nfe && transition(nfe.status, 'cancelada').ok) {
        await this.deps.nfeRepository.updateStatus(nfe.id, 'cancelada', { protocolo: r.data!.protocolo });
      }
      await this.deps.events.emit('fiscal.nfe.cancelamento.homologado', {
        correlationId: input.correlationId, empresaId: input.empresaId, chave: input.chaveAcesso,
        protocolo: r.data!.protocolo, cstat: r.data!.cstat, xmotivo: r.data!.xmotivo,
      });
    } else {
      await this.deps.events.emit('fiscal.nfe.cancelamento.rejeitado', {
        correlationId: input.correlationId, empresaId: input.empresaId, chave: input.chaveAcesso,
        cstat: r.data!.cstat, xmotivo: r.data!.xmotivo,
      });
    }
    return ok({ ...evento, status, ...patch });
  }
}