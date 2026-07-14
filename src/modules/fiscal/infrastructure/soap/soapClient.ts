/**
 * SOAP Client — monta envelope SOAP 1.2 e delega envio ao transport.
 */
import type { ITransport, TransportResponse } from '../transport/httpTransport';
import type { Result } from '../../core/types';

export interface SoapOperation {
  serviceNamespace: string;
  dataElementName: string;
  soapAction: string;
  operationElementName?: string;
}

export interface SoapCall {
  url: string;
  operation: SoapOperation;
  innerXml: string;
  correlationId: string;
  empresaId?: string;
  breakerKey?: string;
  assinar?: boolean;
}

function envelope(op: SoapOperation, innerXml: string): string {
  const inner = op.operationElementName
    ? `<${op.operationElementName} xmlns="${op.serviceNamespace}">${innerXml}</${op.operationElementName}>`
    : innerXml;
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
    `<soap12:Body>` +
    `<${op.dataElementName} xmlns="${op.serviceNamespace}">${inner}</${op.dataElementName}>` +
    `</soap12:Body>` +
    `</soap12:Envelope>`
  );
}

export class SoapClient {
  constructor(private transport: ITransport) {}

  async call(c: SoapCall): Promise<Result<TransportResponse>> {
    const xml = envelope(c.operation, c.innerXml);
    return this.transport.send({
      url: c.url,
      soapAction: c.operation.soapAction,
      xml,
      correlationId: c.correlationId,
      empresaId: c.empresaId,
      breakerKey: c.breakerKey ?? c.operation.soapAction,
      assinar: c.assinar ?? true,
    });
  }
}