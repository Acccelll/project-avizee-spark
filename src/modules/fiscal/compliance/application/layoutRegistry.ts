import type { IArtefatoRepository } from './contracts';
import type { CategoriaArtefato, VersaoArtefato } from '../domain/entities';

/**
 * Registry centralizado para XML, XSD, eventos, protocolos, documentos e schemas.
 * Suporta coexistência de múltiplas versões.
 */
export class LayoutRegistry {
  constructor(private readonly repo: IArtefatoRepository) {}

  async listarPorCategoria(categoria: CategoriaArtefato) {
    return this.repo.listArtefatos({ categoria, ativo: true });
  }

  async versoesCoexistentes(artefatoId: string, refIso = new Date().toISOString()): Promise<VersaoArtefato[]> {
    const todas = await this.repo.listVersoes(artefatoId);
    return todas.filter(
      (v) => v.vigencia.inicio <= refIso && (!v.vigencia.fim || v.vigencia.fim > refIso),
    );
  }
}
