import type { ITributoRepository } from './contracts';
import type { TributoDefinicao } from '../domain/entities';

/**
 * Camada específica para a Reforma Tributária.
 * Não substitui o modelo atual — orquestra a coexistência entre
 * ICMS/IPI/PIS/COFINS/ISS e IBS/CBS/Imposto Seletivo durante a transição legal.
 */
export interface ContextoTransicao {
  refIso: string;
  atual: TributoDefinicao[];
  reforma: TributoDefinicao[];
  modo: 'somente_atual' | 'coexistencia' | 'somente_reforma';
}

export class ReformaTributariaService {
  constructor(private readonly tributos: ITributoRepository) {}

  async contextoTransicao(refIso = new Date().toISOString()): Promise<ContextoTransicao> {
    const vigentes = await this.tributos.listVigentes(refIso);
    const atual = vigentes.filter((t) => ['icms','ipi','pis','cofins','iss'].includes(t.id));
    const reforma = vigentes.filter((t) => ['ibs','cbs','is'].includes(t.id));
    let modo: ContextoTransicao['modo'] = 'somente_atual';
    if (atual.length > 0 && reforma.length > 0) modo = 'coexistencia';
    else if (reforma.length > 0 && atual.length === 0) modo = 'somente_reforma';
    return { refIso, atual, reforma, modo };
  }
}
