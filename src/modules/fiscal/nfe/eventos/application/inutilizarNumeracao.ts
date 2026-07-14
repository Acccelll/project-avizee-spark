/**
 * Inutilização de faixa de numeração de NF-e (nfeInutilizacaoNF).
 */
import type { IEndpointRegistry, IAuditoriaRepository } from '../../../application/contracts';
import type { ISignatureEngine } from '../../../infrastructure/signature/signatureEngine';
import type { SoapClient } from '../../../infrastructure/soap/soapClient';
import type { FiscalEventBus } from '../../../infrastructure/events/eventBus';
import type { IInutilizacaoRepository } from './contracts';
import type { InutilizacaoNumeracao } from '../domain/entities';
import type { UF, Result } from '../../../core/types';
import { ok, fail } from '../../../core/types';
import { makeError, FISCAL_ERROR_CODES } from '../../../core/errors';
import { validarInutilizacao } from '../domain/rules';
import { buildInutilizacaoXml } from '../infrastructure/inutilizacaoXmlBuilder';
import { assinarEEnviar, CSTAT_HOMOLOGADO_INUTILIZACAO } from './_shared';

export interface InutilizarInput {
  inu: InutilizacaoNumeracao;
  uf: UF;
  cUF: string;
}

export class InutilizarNumeracaoUseCase {
  constructor(private deps: {
    inutRepository: IInutilizacaoRepository;
    signature: ISignatureEngine;
    endpoints: IEndpointRegistry;
    soap: SoapClient;
    auditoria: IAuditoriaRepository;
    events: FiscalEventBus;
  }) {}

  async execute(input: InutilizarInput): Promise<Result<InutilizacaoNumeracao>> {
    const rn = validarInutilizacao(input.inu);
    if (!rn.ok) return fail(rn.error!);
    const conflita = await this.deps.inutRepository.existsFaixa(
      input.inu.cnpj, input.inu.serie, input.inu.nNFIni, input.inu.nNFFin,
    );
    if (conflita) return fail(makeError(FISCAL_ERROR_CODES.INTERNAL, 'faixa já inutilizada ou em processamento'));

    await this.deps.inutRepository.save(input.inu);
    await this.deps.events.emit('fiscal.nfe.inutilizacao.solicitada', {
      correlationId: input.inu.correlationId, empresaId: input.inu.empresaId,
    });

    const { xml } = buildInutilizacaoXml(input.inu, { cUF: input.cUF });
    const r = await assinarEEnviar(this.deps, {
      empresaId: input.inu.empresaId,
      correlationId: input.inu.correlationId,
      xml, elementLocalName: 'infInut',
      documento: 'NFe', servico: 'inutilizacao',
      uf: input.uf, ambiente: input.inu.ambiente,
      soapAction: 'nfeInutilizacao', dataElementName: 'nfeDadosMsg',
      breakerSufixo: 'inutilizacao',
      operacaoAuditoria: 'nfe.inutilizacao',
      envelopeBuilder: (assinado) => assinado, // XML já é o próprio inutNFe assinado
    });
    if (!r.ok) {
      await this.deps.inutRepository.updateStatus(input.inu.id, 'rejeitada', { xmotivo: r.error!.message });
      await this.deps.events.emit('fiscal.nfe.inutilizacao.rejeitada', {
        correlationId: input.inu.correlationId, empresaId: input.inu.empresaId, xmotivo: r.error!.message,
      });
      return fail(r.error!);
    }
    const homologada = CSTAT_HOMOLOGADO_INUTILIZACAO.has(r.data!.cstat);
    const status = homologada ? 'homologada' : 'rejeitada';
    const patch = { protocolo: r.data!.protocolo, cstat: r.data!.cstat, xmotivo: r.data!.xmotivo };
    await this.deps.inutRepository.updateStatus(input.inu.id, status, patch);
    await this.deps.events.emit(
      homologada ? 'fiscal.nfe.inutilizacao.homologada' : 'fiscal.nfe.inutilizacao.rejeitada',
      {
        correlationId: input.inu.correlationId, empresaId: input.inu.empresaId,
        cstat: r.data!.cstat, xmotivo: r.data!.xmotivo, protocolo: r.data!.protocolo,
      },
    );
    return ok({ ...input.inu, status, ...patch });
  }
}