/**
 * Carta de Correção Eletrônica — evento 110110. Até 20 CC-es por NF-e;
 * `nSeqEvento` é auto-atribuído a partir do repositório.
 */
import type { IEndpointRegistry, IAuditoriaRepository } from '../../../application/contracts';
import type { ISignatureEngine } from '../../../infrastructure/signature/signatureEngine';
import type { SoapClient } from '../../../infrastructure/soap/soapClient';
import type { FiscalEventBus } from '../../../infrastructure/events/eventBus';
import type { IEventoRepository } from './contracts';
import type { EventoFiscal } from '../domain/entities';
import { TIPO_EVENTO } from '../domain/entities';
import type { Ambiente, UF, Result } from '../../../core/types';
import { ok, fail } from '../../../core/types';
import { makeError, FISCAL_ERROR_CODES } from '../../../core/errors';
import { validarCartaCorrecao } from '../domain/rules';
import { buildEventoXml, buildEnvEvento } from '../infrastructure/eventoXmlBuilder';
import { assinarEEnviar, CSTAT_HOMOLOGADO_EVENTO } from './_shared';

export interface CartaCorrecaoInput {
  empresaId: string;
  correlationId: string;
  chaveAcesso: string;
  cnpjEmit: string;
  xCorrecao: string;
  uf: UF;
  cUF: string;
  ambiente: Ambiente;
}

const CONDICAO_USO =
  'A Carta de Correcao e disciplinada pelo paragrafo 1o-A do art. 7o do Convenio S/N, de 15 de dezembro de 1970 e ' +
  'pode ser utilizada para regularizacao de erro ocorrido na emissao de documento fiscal, desde que o erro nao esteja ' +
  'relacionado com: I - as variaveis que determinam o valor do imposto tais como: base de calculo, aliquota, diferenca de preco, ' +
  'quantidade, valor da operacao ou da prestacao; II - a correcao de dados cadastrais que implique mudanca do remetente ou do ' +
  'destinatario; III - a data de emissao ou de saida.';

export class CartaCorrecaoUseCase {
  constructor(private deps: {
    eventoRepository: IEventoRepository;
    signature: ISignatureEngine;
    endpoints: IEndpointRegistry;
    soap: SoapClient;
    auditoria: IAuditoriaRepository;
    events: FiscalEventBus;
  }) {}

  async execute(input: CartaCorrecaoInput): Promise<Result<EventoFiscal>> {
    const jaEmitidas = await this.deps.eventoRepository.countCartaCorrecao(input.chaveAcesso);
    if (jaEmitidas >= 20) {
      return fail(makeError(FISCAL_ERROR_CODES.INTERNAL, 'limite de 20 CC-e atingido para esta NF-e'));
    }
    const nSeq = jaEmitidas + 1;

    const evento: EventoFiscal = {
      id: crypto.randomUUID(),
      empresaId: input.empresaId,
      chaveAcesso: input.chaveAcesso,
      tipoEvento: TIPO_EVENTO.CARTA_CORRECAO,
      nSeqEvento: nSeq,
      cnpjOrgao: input.cnpjEmit,
      dhEvento: new Date().toISOString(),
      detEvento: { xCorrecao: input.xCorrecao, xCondUso: CONDICAO_USO },
      status: 'pendente',
      correlationId: input.correlationId,
    };
    const rn = validarCartaCorrecao(evento);
    if (!rn.ok) return fail(rn.error!);

    await this.deps.eventoRepository.save(evento);

    const { xml } = buildEventoXml(evento, { cOrgao: input.cUF, ambiente: input.ambiente });
    const r = await assinarEEnviar(this.deps, {
      empresaId: input.empresaId,
      correlationId: input.correlationId,
      xml, elementLocalName: 'infEvento',
      documento: 'NFe', servico: 'recepcaoEvento',
      uf: input.uf, ambiente: input.ambiente,
      soapAction: 'nfeRecepcaoEvento', dataElementName: 'nfeDadosMsg',
      breakerSufixo: 'evento',
      operacaoAuditoria: 'nfe.evento.cce',
      chaveAcesso: input.chaveAcesso,
      envelopeBuilder: (assinado) => buildEnvEvento([assinado]),
    });
    await this.deps.events.emit('fiscal.nfe.cce.transmitida', {
      correlationId: input.correlationId, empresaId: input.empresaId, chave: input.chaveAcesso,
    });
    if (!r.ok) {
      await this.deps.eventoRepository.updateStatus(evento.id, 'rejeitado', { xmotivo: r.error!.message });
      await this.deps.events.emit('fiscal.nfe.cce.rejeitada', {
        correlationId: input.correlationId, empresaId: input.empresaId, chave: input.chaveAcesso,
        xmotivo: r.error!.message,
      });
      return fail(r.error!);
    }
    const homologado = CSTAT_HOMOLOGADO_EVENTO.has(r.data!.cstat);
    const status = homologado ? 'homologado' : 'rejeitado';
    const patch = { protocolo: r.data!.protocolo, cstat: r.data!.cstat, xmotivo: r.data!.xmotivo };
    await this.deps.eventoRepository.updateStatus(evento.id, status, patch);
    await this.deps.events.emit(homologado ? 'fiscal.nfe.cce.homologada' : 'fiscal.nfe.cce.rejeitada', {
      correlationId: input.correlationId, empresaId: input.empresaId, chave: input.chaveAcesso,
      cstat: r.data!.cstat, xmotivo: r.data!.xmotivo, protocolo: r.data!.protocolo,
    });
    return ok({ ...evento, status, ...patch });
  }
}