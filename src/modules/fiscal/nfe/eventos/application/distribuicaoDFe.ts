/**
 * Distribuição DF-e (nfeDistDFeInteresse). Consulta incremental por NSU
 * e persiste os documentos (schema resNFe/procNFe/procEventoNFe/resEvento).
 */
import type { IEndpointRegistry, IAuditoriaRepository } from '../../../application/contracts';
import type { SoapClient } from '../../../infrastructure/soap/soapClient';
import type { FiscalEventBus } from '../../../infrastructure/events/eventBus';
import type { IDistDFeStateRepository, IXmlStorage } from './contracts';
import type { DistDFeDocumento } from '../domain/entities';
import type { Ambiente, UF, Result } from '../../../core/types';
import { ok, fail } from '../../../core/types';
import { makeError, FISCAL_ERROR_CODES } from '../../../core/errors';
import { parseXml, textOf } from '../../../infrastructure/xml/xmlEngine';
import { buildDistDFeXml, type DistDFeMode } from '../infrastructure/distDFeXmlBuilder';

const NS = 'http://www.portalfiscal.inf.br/nfe';

export interface DistDFeInput {
  empresaId: string;
  correlationId: string;
  cnpj: string;
  cUF: string;
  uf: UF;
  ambiente: Ambiente;
  /** Se omitido, usa o último NSU persistido (ou 0). */
  filter?: DistDFeMode;
  /** Loop até esgotar (padrão: 1 ciclo). Limitado por `maxCiclos` para safety. */
  maxCiclos?: number;
}

export interface DistDFeSaida {
  cstat: string;
  xmotivo: string;
  ultNSU: string;
  maxNSU: string;
  totalRecebidos: number;
}

export class DistribuicaoDFeUseCase {
  constructor(private deps: {
    endpoints: IEndpointRegistry;
    soap: SoapClient;
    auditoria: IAuditoriaRepository;
    events: FiscalEventBus;
    state: IDistDFeStateRepository;
    storage: IXmlStorage;
  }) {}

  async execute(input: DistDFeInput): Promise<Result<DistDFeSaida>> {
    const ep = await this.deps.endpoints.resolve({
      documento: 'NFe', uf: 'AN' as unknown as UF, ambiente: input.ambiente,
      servico: 'distribuicaoDFe', versao: '1.35',
    });
    if (!ep) return fail(makeError(FISCAL_ERROR_CODES.ENDPOINT_NOT_REGISTERED, 'distribuicaoDFe não cadastrado'));

    const state = await this.deps.state.get(input.empresaId, input.cnpj);
    let ultNSU = state?.ultNSU ?? '0';
    let maxNSU = state?.maxNSU ?? ultNSU;
    let totalRecebidos = 0;
    let cstat = '000';
    let xmotivo = '';

    const ciclos = Math.max(1, Math.min(input.maxCiclos ?? 1, 10));
    for (let i = 0; i < ciclos; i++) {
      const filter: DistDFeMode = input.filter ?? { modo: 'ultNSU', ultNSU };
      const inner = buildDistDFeXml({
        cnpj: input.cnpj, cUF: input.cUF, ambiente: input.ambiente, filter,
      });
      const tr = await this.deps.soap.call({
        url: ep.url,
        operation: {
          serviceNamespace: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe',
          dataElementName: 'nfeDistDFeInteresse',
          soapAction: 'nfeDistDFeInteresse',
        },
        innerXml: inner,
        correlationId: input.correlationId,
        empresaId: input.empresaId,
        breakerKey: `NFe:AN:distDFe`,
        assinar: false,
      });
      if (!tr.ok) return fail(tr.error!);

      const doc = parseXml(tr.data!.xmlRetorno ?? '');
      if (!doc.ok) return fail(doc.error!);
      cstat = textOf(doc.data!, 'cStat') ?? cstat;
      xmotivo = textOf(doc.data!, 'xMotivo') ?? xmotivo;
      const novoUlt = textOf(doc.data!, 'ultNSU');
      const novoMax = textOf(doc.data!, 'maxNSU');
      if (novoUlt) ultNSU = novoUlt;
      if (novoMax) maxNSU = novoMax;

      const docs = doc.data!.getElementsByTagName('docZip');
      const recebidos: DistDFeDocumento[] = [];
      for (let k = 0; k < docs.length; k++) {
        const el = docs[k];
        const nsu = el.getAttribute('NSU') ?? '';
        const schema = el.getAttribute('schema') ?? '';
        recebidos.push({
          nsu, schema,
          xmlBase64: el.textContent ?? '',
          recebidoEm: new Date().toISOString(),
        });
      }
      if (recebidos.length > 0) {
        await this.deps.state.appendDocumentos(input.empresaId, recebidos);
        totalRecebidos += recebidos.length;
        for (const d of recebidos) {
          await this.deps.events.emit('fiscal.nfe.distdfe.documento_recebido', {
            correlationId: input.correlationId, empresaId: input.empresaId,
            nsu: d.nsu, chave: d.chaveAcesso,
          });
        }
      }

      await this.deps.auditoria.record({
        empresaId: input.empresaId, correlationId: input.correlationId,
        operacao: 'nfe.distdfe', documento: 'NFe',
        cstat, xmotivo, endpointUrl: ep.url,
        payloadExtra: { ultNSU, maxNSU, ciclo: i + 1 },
      });

      // 137 = nenhum documento localizado; encerra o loop
      if (cstat === '137' || ultNSU === maxNSU) break;
    }

    await this.deps.state.upsert({
      empresaId: input.empresaId, cnpj: input.cnpj,
      ultNSU, maxNSU, ultimaConsulta: new Date().toISOString(),
    });
    await this.deps.events.emit('fiscal.nfe.distdfe.consultado', {
      correlationId: input.correlationId, empresaId: input.empresaId,
      cstat, xmotivo, nsu: ultNSU,
    });

    return ok({ cstat, xmotivo, ultNSU, maxNSU, totalRecebidos });
  }
}

export { NS as DIST_DFE_NS };