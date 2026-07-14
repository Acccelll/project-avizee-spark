/**
 * Utilitários compartilhados pelos use cases da Etapa 7.
 * Encapsulam o pipeline `assinar → resolver endpoint → SOAP → parse`
 * evitando duplicação em cancelamento, CC-e, inutilização e manifestação.
 */
import type { IEndpointRegistry, IAuditoriaRepository } from '../../../application/contracts';
import type { ISignatureEngine } from '../../../infrastructure/signature/signatureEngine';
import type { SoapClient } from '../../../infrastructure/soap/soapClient';
import type { Ambiente, UF, Result } from '../../../core/types';
import { ok, fail } from '../../../core/types';
import { makeError, FISCAL_ERROR_CODES } from '../../../core/errors';
import { parseXml, textOf } from '../../../infrastructure/xml/xmlEngine';

const NS = 'http://www.portalfiscal.inf.br/nfe';

export interface AssinarEEnviarInput {
  empresaId: string;
  correlationId: string;
  xml: string;
  elementLocalName: string;
  documento: 'NFe';
  servico: string;
  uf: UF;
  ambiente: Ambiente;
  soapAction: string;
  dataElementName: string;
  breakerSufixo: string;
  operacaoAuditoria: string;
  chaveAcesso?: string;
  envelopeBuilder: (assinadoXml: string) => string;
}

export interface AssinarEEnviarSaida {
  cstat: string;
  xmotivo: string;
  protocolo?: string;
  xmlRetorno: string;
}

export async function assinarEEnviar(
  deps: {
    signature: ISignatureEngine;
    endpoints: IEndpointRegistry;
    soap: SoapClient;
    auditoria: IAuditoriaRepository;
  },
  input: AssinarEEnviarInput,
): Promise<Result<AssinarEEnviarSaida>> {
  const sig = await deps.signature.sign({
    empresaId: input.empresaId,
    xml: input.xml,
    elementLocalName: input.elementLocalName,
    correlationId: input.correlationId,
  });
  if (!sig.ok) return fail(sig.error!);

  const ep = await deps.endpoints.resolve({
    documento: input.documento,
    uf: input.uf,
    ambiente: input.ambiente,
    servico: input.servico,
    versao: '4.00',
  });
  if (!ep) {
    return fail(makeError(
      FISCAL_ERROR_CODES.ENDPOINT_NOT_REGISTERED,
      `${input.documento}/${input.servico} ${input.uf}/${input.ambiente} não cadastrado`,
    ));
  }

  const envelope = input.envelopeBuilder(sig.data!.xmlAssinado);
  const tr = await deps.soap.call({
    url: ep.url,
    operation: {
      serviceNamespace: NS,
      dataElementName: input.dataElementName,
      soapAction: input.soapAction,
    },
    innerXml: envelope,
    correlationId: input.correlationId,
    empresaId: input.empresaId,
    breakerKey: `${input.documento}:${input.uf}:${input.breakerSufixo}`,
    assinar: false,
  });
  if (!tr.ok) return fail(tr.error!);

  const doc = parseXml(tr.data!.xmlRetorno ?? '');
  if (!doc.ok) return fail(doc.error!);
  const cstat = textOf(doc.data!, 'cStat') ?? '000';
  const xmotivo = textOf(doc.data!, 'xMotivo') ?? '';
  const protocolo = textOf(doc.data!, 'nProt') ?? undefined;

  await deps.auditoria.record({
    empresaId: input.empresaId,
    correlationId: input.correlationId,
    operacao: input.operacaoAuditoria,
    documento: input.documento,
    chaveAcesso: input.chaveAcesso,
    cstat, xmotivo,
    endpointUrl: ep.url,
  });

  return ok({ cstat, xmotivo, protocolo, xmlRetorno: tr.data!.xmlRetorno ?? '' });
}

/** cStat de homologação típicos para eventos: 135 (homologado), 136 (vinculado). */
export const CSTAT_HOMOLOGADO_EVENTO = new Set(['135', '136', '155']);
export const CSTAT_HOMOLOGADO_INUTILIZACAO = new Set(['102']);