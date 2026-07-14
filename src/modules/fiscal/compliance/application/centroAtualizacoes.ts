import type { IArtefatoRepository } from './contracts';
import type { VersaoArtefato } from '../domain/entities';

/**
 * Centro de Atualizações — administra as versões fiscais disponíveis.
 * Nenhuma atualização é aplicada sem validação prévia (`preValidar`).
 */
export interface PlanoAtualizacao {
  artefatoId: string;
  versaoAlvo: string;
  requerAprovacao: boolean;
  observacoes?: string;
}

export class CentroAtualizacoesService {
  constructor(private readonly artefatos: IArtefatoRepository) {}

  async catalogo() {
    const list = await this.artefatos.listArtefatos();
    const detalhado = await Promise.all(list.map(async (a) => ({
      artefato: a,
      versoes: await this.artefatos.listVersoes(a.id),
    })));
    return detalhado;
  }

  async preValidar(plano: PlanoAtualizacao) {
    const versoes = await this.artefatos.listVersoes(plano.artefatoId);
    const alvo = versoes.find((v) => v.versao === plano.versaoAlvo);
    const problemas: string[] = [];
    if (!alvo) problemas.push('Versão alvo não registrada');
    if (alvo?.dependencias?.length) {
      problemas.push(`Dependências a resolver: ${alvo.dependencias.join(', ')}`);
    }
    return { ok: problemas.length === 0, problemas, alvo };
  }

  async aplicar(plano: PlanoAtualizacao, aprovadoPor: string): Promise<VersaoArtefato> {
    const check = await this.preValidar(plano);
    if (!check.ok) throw new Error(`Atualização bloqueada: ${check.problemas.join('; ')}`);
    if (plano.requerAprovacao && !aprovadoPor) throw new Error('Aprovação obrigatória');
    return check.alvo!;
  }
}
