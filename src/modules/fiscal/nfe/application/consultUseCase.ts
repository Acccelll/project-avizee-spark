/**
 * Consulta de situação da NF-e (consSitNFe). Não assina o request.
 */
import type { INFeRepository } from './contracts';
import type { IEndpointRegistry, IAuditoriaRepository } from '../../application/contracts';
import type { SoapClient } from '../../infrastructure/soap/soapClient';
import type { FiscalEventBus } from '../../infrastructure/events/eventBus';
import type { Ambiente, UF, Result } from '../../core/types';
import { ok, fail } from '../../core/types';
import { parseXml, textOf, withProlog } from '../../infrastructure/xml/xmlEngine';
import { makeError, FISCAL_ERROR_CODES } from '../../core/errors';

const NS = 'http://www.portalfiscal.inf.br/nfe';

export interface ConsultRequest {
  chave: string;
  uf: UF;
  ambiente: Ambiente;
  empresaId: string;
  correlationId: string;
}

export interface ConsultResult {
  cstat: string;
  xmotivo: string;
  protocolo?: string;
}

export class ConsultNFeUseCase {
  constructor(private deps: {
    repository: INFeRepository;
    endpoints: IEndpointRegistry;
    soap: SoapClient;
    auditoria: IAuditoriaRepository;
    events: FiscalEventBus;
  }) {}

  async execute(req: ConsultRequest): Promise<Result<ConsultResult>> {
    const ep = await this.deps.endpoints.resolve({
      documento: 'NFe', uf: req.uf, ambiente: req.ambiente,
      servico: 'consultaProtocolo', versao: '4.00',
    });
    if (!ep) return fail(makeError(FISCAL_ERROR_CODES.ENDPOINT_NOT_REGISTERED, 'consultaProtocolo não cadastrado'));

    const inner = withProlog(
      `<consSitNFe xmlns="${NS}" versao="4.00"><tpAmb>${req.ambiente}</tpAmb><xServ>CONSULTAR</xServ><chNFe>${req.chave}</chNFe></consSitNFe>`,
    );
    const tr = await this.deps.soap.call({
      url: ep.url,
      operation: { serviceNamespace: NS, dataElementName: 'nfeDadosMsg', soapAction: 'nfeConsultaProtocolo' },
      innerXml: inner,
      correlationId: req.correlationId,
      empresaId: req.empresaId,
      breakerKey: `NFe:${req.uf}:consultaProtocolo`,
      assinar: false,
    });
    if (!tr.ok) return fail(tr.error!);

    const doc = parseXml(tr.data!.xmlRetorno ?? '');
    if (!doc.ok) return fail(doc.error!);
    const cstat = textOf(doc.data!, 'cStat') ?? '000';
    const xmotivo = textOf(doc.data!, 'xMotivo') ?? '';
    const protocolo = textOf(doc.data!, 'nProt') ?? undefined;

    await this.deps.auditoria.record({
      empresaId: req.empresaId, correlationId: req.correlationId,
      operacao: 'nfe.consulta', documento: 'NFe',
      chaveAcesso: req.chave, cstat, xmotivo, endpointUrl: ep.url,
    });
    await this.deps.events.emit('fiscal.nfe.consultada', {
      correlationId: req.correlationId, empresaId: req.empresaId, chave: req.chave, cstat, xmotivo,
    });

    return ok({ cstat, xmotivo, protocolo });
  }
}