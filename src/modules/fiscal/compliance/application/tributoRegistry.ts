import type { ITributoRepository } from './contracts';
import type { TributoDefinicao } from '../domain/entities';

/**
 * Registry de tributos parametrizados — permite adicionar novos tributos
 * (IBS, CBS, Imposto Seletivo, futuros) sem alteração estrutural.
 */
export class TributoRegistry {
  constructor(private readonly repo: ITributoRepository) {}

  registrar(t: TributoDefinicao) {
    if (t.vigencia.fim && t.vigencia.fim <= t.vigencia.inicio) {
      throw new Error('Vigência inválida: fim <= inicio');
    }
    return this.repo.upsert(t);
  }

  vigentes(refIso?: string) { return this.repo.listVigentes(refIso); }

  async modelosVigentes(refIso?: string): Promise<{ atual: TributoDefinicao[]; reforma: TributoDefinicao[] }> {
    const vs = await this.repo.listVigentes(refIso);
    return {
      atual: vs.filter((t) => t.modelo === 'atual' || t.modelo === 'coexistencia'),
      reforma: vs.filter((t) => t.modelo === 'reforma' || t.modelo === 'coexistencia'),
    };
  }
}
