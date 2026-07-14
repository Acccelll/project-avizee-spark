/**
 * Consulta de recibo de lote (nfeRetAutorizacao). Retorna cStat/xMotivo
 * e, quando processado, o protocolo autorizado por NF-e.
 */
import type { IEndpointRegistry, IAuditoriaRepository } from '../../../application/contracts';
import type { SoapClient } from '../../../infrastructure/soap/soapClient';
import type { FiscalEventBus } from '../../../infrastructure/events/eventBus';
import type { Ambiente, UF, Result } from '../../../core/types';
import { ok, fail } from '../../../core/types';
import { makeError, FISCAL_ERROR_CODES } from '../../../core/errors';
import { parseXml, textOf, withProlog } from '../../../infrastructure/xml/xmlEngine';

const NS = 'http://www.portalfiscal.inf.br/nfe';

export interface ConsultarReciboInput {
  empresaId: string;
  correlationId: string;
  recibo: string;
  uf: UF;
  ambiente: Ambiente;
}

export interface ConsultarReciboSaida {
  cstat: string;
  xmotivo: string;
  protocolos: string[];
  xmlRetorno: string;
}

export class ConsultarReciboUseCase {
  constructor(private deps: {
    endpoints: IEndpointRegistry;
    soap: SoapClient;
    auditoria: IAuditoriaRepository;
    events: FiscalEventBus;
  }) {}

  async execute(input: ConsultarReciboInput): Promise<Result<ConsultarReciboSaida>> {
    const ep = await this.deps.endpoints.resolve({
      documento: 'NFe', uf: input.uf, ambiente: input.ambiente,
      servico: 'retAutorizacao', versao: '4.00',
    });
    if (!ep) return fail(makeError(FISCAL_ERROR_CODES.ENDPOINT_NOT_REGISTERED, 'retAutorizacao não cadastrado'));

    const inner = withProlog(
      `<consReciNFe xmlns="${NS}" versao="4.00"><tpAmb>${input.ambiente}</tpAmb><nRec>${input.recibo}</nRec></consReciNFe>`,
    );
    const tr = await this.deps.soap.call({
      url: ep.url,
      operation: { serviceNamespace: NS, dataElementName: 'nfeDadosMsg', soapAction: 'nfeRetAutorizacaoLote' },
      innerXml: inner,
      correlationId: input.correlationId,
      empresaId: input.empresaId,
      breakerKey: `NFe:${input.uf}:retAutorizacao`,
      assinar: false,
    });
    if (!tr.ok) return fail(tr.error!);

    const doc = parseXml(tr.data!.xmlRetorno ?? '');
    if (!doc.ok) return fail(doc.error!);
    const cstat = textOf(doc.data!, 'cStat') ?? '000';
    const xmotivo = textOf(doc.data!, 'xMotivo') ?? '';
    const protocolos: string[] = [];
    const nodes = doc.data!.getElementsByTagName('nProt');
    for (let i = 0; i < nodes.length; i++) {
      const t = nodes[i].textContent;
      if (t) protocolos.push(t);
    }

    await this.deps.auditoria.record({
      empresaId: input.empresaId, correlationId: input.correlationId,
      operacao: 'nfe.recibo.consulta', documento: 'NFe',
      cstat, xmotivo, endpointUrl: ep.url,
    });
    await this.deps.events.emit('fiscal.nfe.recibo.consultado', {
      correlationId: input.correlationId, empresaId: input.empresaId,
      cstat, xmotivo,
    });
    return ok({ cstat, xmotivo, protocolos, xmlRetorno: tr.data!.xmlRetorno ?? '' });
  }
}