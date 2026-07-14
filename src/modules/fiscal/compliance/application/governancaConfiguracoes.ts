import type { IConfiguracaoVersionadaRepository } from './contracts';
import type { ConfiguracaoVersao } from '../domain/entities';

/**
 * Governança de configurações versionadas: registro, aprovação, rollback,
 * histórico e comparação entre versões.
 */
export class GovernancaConfiguracoesService {
  constructor(private readonly repo: IConfiguracaoVersionadaRepository) {}

  async registrar<T>(chave: string, valor: T, autor: string, opcoes?: {
    aprovadoPor?: string; vigenciaInicio?: string; vigenciaFim?: string; descricao?: string;
  }): Promise<ConfiguracaoVersao<T>> {
    const historico = await this.repo.historico(chave);
    const versao = (historico.at(-1)?.versao ?? 0) + 1;
    const cfg: ConfiguracaoVersao<T> = {
      id: `${chave}:v${versao}`,
      chave, versao, valor, autor,
      aprovadoPor: opcoes?.aprovadoPor,
      aprovadoEm: opcoes?.aprovadoPor ? new Date().toISOString() : undefined,
      vigenciaInicio: opcoes?.vigenciaInicio ?? new Date().toISOString(),
      vigenciaFim: opcoes?.vigenciaFim,
      descricao: opcoes?.descricao,
    };
    await this.repo.registrar(cfg);
    return cfg;
  }

  async rollback(chave: string, versaoAlvo: number, autor: string): Promise<ConfiguracaoVersao> {
    const historico = await this.repo.historico(chave);
    const alvo = historico.find((c) => c.versao === versaoAlvo);
    if (!alvo) throw new Error(`Configuração ${chave} v${versaoAlvo} não encontrada`);
    return this.registrar(chave, alvo.valor, autor, { descricao: `rollback -> v${versaoAlvo}` });
  }

  historico(chave: string) { return this.repo.historico(chave); }
  vigente<T>(chave: string, refIso?: string) { return this.repo.vigente<T>(chave, refIso); }

  async comparar(chave: string, a: number, b: number) {
    const historico = await this.repo.historico(chave);
    return {
      a: historico.find((c) => c.versao === a) ?? null,
      b: historico.find((c) => c.versao === b) ?? null,
    };
  }
}
