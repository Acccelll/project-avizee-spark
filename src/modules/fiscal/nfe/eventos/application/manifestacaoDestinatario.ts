/**
 * Manifestação do destinatário (ciência, confirmação, desconhecimento
 * ou operação não realizada). Utiliza o mesmo recepcaoEvento do AN.
 */
import type { IEndpointRegistry, IAuditoriaRepository } from '../../../application/contracts';
import type { ISignatureEngine } from '../../../infrastructure/signature/signatureEngine';
import type { SoapClient } from '../../../infrastructure/soap/soapClient';
import type { FiscalEventBus } from '../../../infrastructure/events/eventBus';
import type { IEventoRepository } from './contracts';
import type { EventoFiscal, TipoEventoNFe } from '../domain/entities';
import type { Ambiente, Result } from '../../../core/types';
import { ok, fail } from '../../../core/types';
import { validarManifestacao } from '../domain/rules';
import { buildEventoXml, buildEnvEvento } from '../infrastructure/eventoXmlBuilder';
import { assinarEEnviar, CSTAT_HOMOLOGADO_EVENTO } from './_shared';

/** Ambiente Nacional — cOrgao=91, UF alias 'AN'. */
const AN_UF = 'AN' as unknown as never;

export interface ManifestacaoInput {
  empresaId: string;
  correlationId: string;
  chaveAcesso: string;
  cnpjDestinatario: string;
  tipo: TipoEventoNFe;
  justificativa?: string;
  ambiente: Ambiente;
}

export class ManifestacaoDestinatarioUseCase {
  constructor(private deps: {
    eventoRepository: IEventoRepository;
    signature: ISignatureEngine;
    endpoints: IEndpointRegistry;
    soap: SoapClient;
    auditoria: IAuditoriaRepository;
    events: FiscalEventBus;
  }) {}

  async execute(input: ManifestacaoInput): Promise<Result<EventoFiscal>> {
    const detEvento: Record<string, string> = { descEvento: 'Manifestacao' };
    if (input.justificativa) detEvento.xJust = input.justificativa;

    const evento: EventoFiscal = {
      id: crypto.randomUUID(),
      empresaId: input.empresaId,
      chaveAcesso: input.chaveAcesso,
      tipoEvento: input.tipo,
      nSeqEvento: 1,
      cnpjOrgao: input.cnpjDestinatario,
      dhEvento: new Date().toISOString(),
      detEvento,
      status: 'pendente',
      correlationId: input.correlationId,
    };
    const rn = validarManifestacao(evento);
    if (!rn.ok) return fail(rn.error!);

    await this.deps.eventoRepository.save(evento);

    const { xml } = buildEventoXml(evento, { cOrgao: '91', ambiente: input.ambiente });
    const r = await assinarEEnviar(this.deps, {
      empresaId: input.empresaId,
      correlationId: input.correlationId,
      xml, elementLocalName: 'infEvento',
      documento: 'NFe',
      servico: 'recepcaoEventoAN',
      uf: AN_UF,
      ambiente: input.ambiente,
      soapAction: 'nfeRecepcaoEvento', dataElementName: 'nfeDadosMsg',
      breakerSufixo: 'manifestacao',
      operacaoAuditoria: 'nfe.manifestacao',
      chaveAcesso: input.chaveAcesso,
      envelopeBuilder: (assinado) => buildEnvEvento([assinado]),
    });
    await this.deps.events.emit('fiscal.nfe.manifestacao.transmitida', {
      correlationId: input.correlationId, empresaId: input.empresaId,
      chave: input.chaveAcesso, tipoEvento: input.tipo,
    });
    if (!r.ok) {
      await this.deps.eventoRepository.updateStatus(evento.id, 'rejeitado', { xmotivo: r.error!.message });
      return fail(r.error!);
    }
    const homologado = CSTAT_HOMOLOGADO_EVENTO.has(r.data!.cstat);
    const status = homologado ? 'homologado' : 'rejeitado';
    const patch = { protocolo: r.data!.protocolo, cstat: r.data!.cstat, xmotivo: r.data!.xmotivo };
    await this.deps.eventoRepository.updateStatus(evento.id, status, patch);
    if (homologado) {
      await this.deps.events.emit('fiscal.nfe.manifestacao.homologada', {
        correlationId: input.correlationId, empresaId: input.empresaId,
        chave: input.chaveAcesso, tipoEvento: input.tipo,
        cstat: r.data!.cstat, xmotivo: r.data!.xmotivo, protocolo: r.data!.protocolo,
      });
    }
    return ok({ ...evento, status, ...patch });
  }
}