/**
 * Caso de uso: autorizar NF-e (fluxo síncrono).
 *
 * Passos:
 *  1. valida regras de negócio
 *  2. gera XML (builder)
 *  3. valida XSD leve (raiz + namespace)
 *  4. assina via ISignatureEngine (delegado ao sefaz-proxy)
 *  5. resolve endpoint via IEndpointRegistry
 *  6. transmite via SoapClient
 *  7. atualiza status na porta de repositório
 *  8. emite eventos + auditoria
 *
 * Reutiliza 100% da infra da Etapa 5. Zero conhecimento de HTTP/certificado.
 */
import type { NFe } from '../domain/entities';
import type { INFeRepository } from './contracts';
import type { IEndpointRegistry, IAuditoriaRepository } from '../../application/contracts';
import type { ISignatureEngine } from '../../infrastructure/signature/signatureEngine';
import type { SoapClient } from '../../infrastructure/soap/soapClient';
import type { FiscalEventBus } from '../../infrastructure/events/eventBus';
import { buildNFeXml, buildEnviNFe } from '../infrastructure/nfeXmlBuilder';
import { ClientSideXsdValidator } from '../../infrastructure/xml/xsdValidator';
import { validarNFe } from '../domain/rules';
import { transition } from '../domain/stateMachine';
import { makeError, FISCAL_ERROR_CODES } from '../../core/errors';
import { parseXml, textOf } from '../../infrastructure/xml/xmlEngine';
import type { Result } from '../../core/types';
import { ok, fail } from '../../core/types';

const NS = 'http://www.portalfiscal.inf.br/nfe';

export interface AuthorizeDeps {
  repository: INFeRepository;
  signature: ISignatureEngine;
  endpoints: IEndpointRegistry;
  soap: SoapClient;
  auditoria: IAuditoriaRepository;
  events: FiscalEventBus;
}

export interface AuthorizeResult {
  chave: string;
  cstat: string;
  xmotivo: string;
  protocolo?: string;
  xmlProc?: string;
}

export class AuthorizeNFeUseCase {
  private xsd = new ClientSideXsdValidator();
  constructor(private deps: AuthorizeDeps) {}

  async execute(nfe: NFe): Promise<Result<AuthorizeResult>> {
    const { repository, signature, endpoints, soap, auditoria, events } = this.deps;

    // 1) domínio
    const rn = validarNFe(nfe);
    if (!rn.ok) return fail(rn.error!);
    let cur = transition(nfe.status, 'validada');
    if (!cur.ok) return fail(cur.error!);
    await events.emit('fiscal.nfe.validada', { correlationId: nfe.correlationId, empresaId: nfe.empresaId });

    // 2) XML
    const { xml, chave } = buildNFeXml(nfe);

    // 3) XSD leve
    const xsd = await this.xsd.validate(xml, { schemaRoot: 'nfe_v4.00.xsd', rootElement: 'NFe', namespace: NS });
    if (!xsd.ok) return fail(xsd.error!);

    // 4) assinatura
    const sig = await signature.sign({
      empresaId: nfe.empresaId,
      xml,
      elementLocalName: 'infNFe',
      correlationId: nfe.correlationId,
    });
    if (!sig.ok) return fail(sig.error!);
    cur = transition('validada', 'assinada');
    if (!cur.ok) return fail(cur.error!);
    await events.emit('fiscal.nfe.assinada', { correlationId: nfe.correlationId, empresaId: nfe.empresaId, chave });

    // 5) endpoint
    const ep = await endpoints.resolve({
      documento: 'NFe',
      uf: nfe.emitente.uf,
      ambiente: nfe.ide.ambiente,
      servico: 'autorizacao',
      versao: '4.00',
    });
    if (!ep) {
      return fail(makeError(
        FISCAL_ERROR_CODES.ENDPOINT_NOT_REGISTERED,
        `endpoint NFe/autorizacao ${nfe.emitente.uf}/${nfe.ide.ambiente} não cadastrado`,
      ));
    }

    // 6) transporte SOAP
    const envelope = buildEnviNFe(sig.data!.xmlAssinado);
    const tr = await soap.call({
      url: ep.url,
      operation: {
        serviceNamespace: NS,
        dataElementName: 'nfeDadosMsg',
        soapAction: 'nfeAutorizacaoLote',
      },
      innerXml: envelope,
      correlationId: nfe.correlationId,
      empresaId: nfe.empresaId,
      breakerKey: `NFe:${nfe.emitente.uf}:autorizacao`,
      assinar: false, // já assinado
    });
    await events.emit('fiscal.nfe.transmitida', { correlationId: nfe.correlationId, empresaId: nfe.empresaId, chave });
    if (!tr.ok) return fail(tr.error!);

    // 7) parse retorno + status
    const doc = parseXml(tr.data!.xmlRetorno ?? '');
    if (!doc.ok) return fail(doc.error!);
    const cstat = textOf(doc.data!, 'cStat') ?? '000';
    const xmotivo = textOf(doc.data!, 'xMotivo') ?? '';
    const protocolo = textOf(doc.data!, 'nProt') ?? undefined;

    const autorizadoCstat = new Set(['100', '150']);
    const denegadoCstat = new Set(['110', '301', '302', '303']);
    const novoStatus = autorizadoCstat.has(cstat)
      ? 'autorizada'
      : denegadoCstat.has(cstat)
        ? 'denegada'
        : 'rejeitada';
    const trans = transition('assinada', novoStatus as never);
    if (!trans.ok) return fail(trans.error!);

    await repository.updateStatus(nfe.id, novoStatus, {
      chaveAcesso: chave,
      protocolo,
    });
    await auditoria.record({
      empresaId: nfe.empresaId,
      correlationId: nfe.correlationId,
      operacao: 'nfe.autorizacao',
      documento: 'NFe',
      chaveAcesso: chave,
      cstat,
      xmotivo,
      endpointUrl: ep.url,
    });
    await events.emit(`fiscal.nfe.${novoStatus === 'autorizada' ? 'autorizada' : novoStatus}`, {
      correlationId: nfe.correlationId,
      empresaId: nfe.empresaId,
      chave,
      cstat,
      xmotivo,
    });

    return ok({ chave, cstat, xmotivo, protocolo, xmlProc: tr.data!.xmlNfeProc });
  }
}