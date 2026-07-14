import type { IArtefatoRepository, INormaRepository } from './contracts';
import type { Artefato, VersaoArtefato, NormaLegal } from '../domain/entities';

/**
 * Serviço de versionamento legal: mantém artefatos (layouts, XSD, WS,
 * endpoints, schemas, eventos, protocolos, regras) e suas versões vigentes.
 */
export class VersionamentoLegalService {
  constructor(
    private readonly artefatos: IArtefatoRepository,
    private readonly normas: INormaRepository,
  ) {}

  registrarNorma(n: NormaLegal) { return this.normas.upsert(n); }

  registrarArtefato(a: Artefato) { return this.artefatos.upsertArtefato(a); }

  registrarVersao(v: VersaoArtefato) {
    if (v.vigencia.fim && v.vigencia.fim <= v.vigencia.inicio) {
      throw new Error('Vigência inválida: fim <= inicio');
    }
    return this.artefatos.upsertVersao(v);
  }

  vigente(artefatoId: string, refIso?: string) {
    return this.artefatos.getVersaoVigente(artefatoId, refIso);
  }

  historico(artefatoId: string) { return this.artefatos.listVersoes(artefatoId); }
}
