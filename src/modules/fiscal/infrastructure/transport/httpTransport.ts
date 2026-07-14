/**
 * Transport Layer — envio SOAP à SEFAZ sempre via Edge `sefaz-proxy`.
 * O client nunca fala direto com a SEFAZ (mTLS + renegociação TLS não
 * são suportados por rustls/Deno — ver mem `sefaz-mtls-transporte`).
 */
import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { withRetry, type RetryOptions } from './retryPolicy';
import { CircuitBreaker } from './circuitBreaker';
import { makeError, FISCAL_ERROR_CODES } from '../../core/errors';
import type { Result } from '../../core/types';
import { ok, fail } from '../../core/types';
import { fiscalLogger } from '../logging/fiscalLogger';

export interface TransportRequest {
  url: string;
  soapAction: string;
  xml: string;
  correlationId: string;
  breakerKey: string;
  timeoutMs?: number;
  retry?: RetryOptions;
  assinar: boolean;
  empresaId?: string;
}

export interface TransportResponse {
  status: number;
  xmlRetorno?: string;
  xmlNfeProc?: string;
  caminhoXml?: string | null;
}

export interface ITransport {
  send(req: TransportRequest): Promise<Result<TransportResponse>>;
}

const DEFAULT_RETRY: RetryOptions = { max: 3, backoffMs: [500, 1500, 3000] };

export class HttpTransport implements ITransport {
  constructor(private breaker: CircuitBreaker = new CircuitBreaker()) {}

  async send(req: TransportRequest): Promise<Result<TransportResponse>> {
    if (!this.breaker.canPass(req.breakerKey)) {
      return fail(makeError(FISCAL_ERROR_CODES.BREAKER_OPEN, `breaker aberto para ${req.breakerKey}`));
    }
    const retry = req.retry ?? DEFAULT_RETRY;
    const started = Date.now();

    const result = await withRetry<TransportResponse>(async (attempt) => {
      try {
        const { data, error } = await supabase.functions.invoke('sefaz-proxy', {
          body: {
            action: req.assinar ? 'assinar-e-enviar-vault' : 'enviar-sem-assinatura-vault',
            xml: req.xml,
            url: req.url,
            soapAction: req.soapAction,
            correlationId: req.correlationId,
            empresaId: req.empresaId,
          },
        });
        if (error) {
          const status =
            error instanceof FunctionsHttpError
              ? (error.context as Response | undefined)?.status
              : undefined;
          if (status === 404) {
            return fail(makeError(FISCAL_ERROR_CODES.NETWORK_UNREACHABLE, 'sefaz-proxy não deployado', error));
          }
          return fail(makeError(FISCAL_ERROR_CODES.NETWORK_TIMEOUT, error.message, error));
        }
        if (!data?.sucesso) {
          return fail(makeError(FISCAL_ERROR_CODES.SOAP_FAULT, data?.erro ?? 'falha SOAP'));
        }
        return ok({
          status: data.statusHttp ?? 200,
          xmlRetorno: data.xmlRetorno,
          xmlNfeProc: data.xmlNfeProc,
          caminhoXml: data.caminhoXml ?? null,
        });
      } catch (e) {
        fiscalLogger.warn('transport.exception', { attempt, err: String(e), correlationId: req.correlationId });
        return fail(makeError(FISCAL_ERROR_CODES.NETWORK_UNREACHABLE, String(e), e));
      }
    }, retry);

    if (result.ok) this.breaker.reportSuccess(req.breakerKey);
    else this.breaker.reportFailure(req.breakerKey);

    fiscalLogger.info('transport.completed', {
      correlationId: req.correlationId,
      durationMs: Date.now() - started,
      ok: result.ok,
      breakerKey: req.breakerKey,
    });
    return result;
  }
}