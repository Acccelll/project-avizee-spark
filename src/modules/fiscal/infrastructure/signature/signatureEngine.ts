/**
 * Signature Engine — contrato.
 *
 * A assinatura XMLDSig real é realizada server-side pelo `sefaz-proxy`
 * (action `assinar-e-enviar-vault`) usando o A1 do Storage + Vault. Este
 * módulo apenas expõe a interface e um adaptador HTTP para o resto do
 * framework, mantendo o contrato desacoplado do canal de transporte.
 *
 * Ver ADR-002 (c14n própria vs lib) e ADR-004 (signature suite ágil).
 */
import type { Result } from '../../core/types';
import { ok, fail } from '../../core/types';
import { makeError, FISCAL_ERROR_CODES } from '../../core/errors';
import { supabase } from '@/integrations/supabase/client';

export interface SignatureSuite {
  digestUri: string;
  signatureUri: string;
  hashName: 'SHA-1' | 'SHA-256';
}

export const DEFAULT_SUITE: SignatureSuite = {
  digestUri: 'http://www.w3.org/2000/09/xmldsig#sha1',
  signatureUri: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
  hashName: 'SHA-1',
};

export interface SignRequest {
  empresaId: string;
  xml: string;
  elementLocalName: string; // ex.: 'infNFe', 'infEvento'
  suite?: SignatureSuite;
  correlationId: string;
}

export interface SignResponse {
  xmlAssinado: string;
}

export interface ISignatureEngine {
  sign(req: SignRequest): Promise<Result<SignResponse>>;
}

/**
 * Delegator para o Edge `sefaz-proxy` (action `assinar-somente`).
 * A action ainda não foi implementada — este adaptador prepara o contrato
 * para quando a Etapa 6 ativar a emissão real.
 */
export class ServerSideSignatureEngine implements ISignatureEngine {
  async sign(req: SignRequest): Promise<Result<SignResponse>> {
    try {
      const { data, error } = await supabase.functions.invoke('sefaz-proxy', {
        body: {
          action: 'assinar-somente',
          empresaId: req.empresaId,
          xml: req.xml,
          elementLocalName: req.elementLocalName,
          suite: req.suite ?? DEFAULT_SUITE,
          correlationId: req.correlationId,
        },
      });
      if (error) return fail(makeError(FISCAL_ERROR_CODES.SIGN_FAILED, error.message, error));
      if (!data?.sucesso) {
        return fail(makeError(FISCAL_ERROR_CODES.SIGN_FAILED, data?.erro ?? 'sign failed'));
      }
      return ok({ xmlAssinado: data.xmlAssinado });
    } catch (e) {
      return fail(makeError(FISCAL_ERROR_CODES.SIGN_FAILED, String(e), e));
    }
  }
}