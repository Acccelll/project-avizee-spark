/**
 * XSD Validator — contrato. Validação estrutural real acontece server-side
 * (Edge Function) usando os XSDs de `fiscal_schemas_pl`. No client
 * expomos apenas uma checagem leve de well-formedness + tag raiz.
 */
import { parseXml } from './xmlEngine';
import { makeError, FISCAL_ERROR_CODES } from '../../core/errors';
import type { Result } from '../../core/types';
import { ok, fail } from '../../core/types';

export interface XsdSpec {
  schemaRoot: string;    // ex.: 'enviNFe_v4.00.xsd'
  rootElement: string;   // ex.: 'enviNFe'
  namespace?: string;
}

export interface IXsdValidator {
  validate(xml: string, spec: XsdSpec): Promise<Result<true>>;
}

export class ClientSideXsdValidator implements IXsdValidator {
  async validate(xml: string, spec: XsdSpec): Promise<Result<true>> {
    const parsed = parseXml(xml);
    if (!parsed.ok) return parsed as Result<true>;
    const root = parsed.data!.documentElement;
    if (root.localName !== spec.rootElement) {
      return fail(
        makeError(
          FISCAL_ERROR_CODES.XSD_INVALID,
          `elemento raiz esperado <${spec.rootElement}>, recebido <${root.localName}>`,
        ),
      );
    }
    if (spec.namespace && root.namespaceURI !== spec.namespace) {
      return fail(
        makeError(
          FISCAL_ERROR_CODES.XSD_INVALID,
          `namespace esperado ${spec.namespace}, recebido ${root.namespaceURI}`,
        ),
      );
    }
    return ok(true as const);
  }
}