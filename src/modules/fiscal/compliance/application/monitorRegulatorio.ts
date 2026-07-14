import type { IMudancaRepository } from './contracts';
import type { MudancaRegulatoria, StatusMudanca } from '../domain/entities';

/**
 * Monitor Regulatório — registra alterações legais, pendências, impactos
 * e status de adequação por módulo. Preparado para integrações futuras
 * com fontes oficiais (SEFAZ, Receita Federal, CONFAZ etc).
 */
export class MonitorRegulatorioService {
  constructor(private readonly repo: IMudancaRepository) {}

  registrar(m: Omit<MudancaRegulatoria, 'criadoEm' | 'atualizadoEm'>) {
    const now = new Date().toISOString();
    const full: MudancaRegulatoria = { ...m, criadoEm: now, atualizadoEm: now };
    return this.repo.upsert(full).then(() => full);
  }

  async atualizarStatus(id: string, status: StatusMudanca): Promise<MudancaRegulatoria> {
    const atual = await this.repo.get(id);
    if (!atual) throw new Error(`Mudança ${id} não encontrada`);
    const upd = { ...atual, status, atualizadoEm: new Date().toISOString() };
    await this.repo.upsert(upd);
    return upd;
  }

  pendencias() { return this.repo.list({ status: 'identificada' }); }
  porModulo(modulo: string) { return this.repo.list({ modulo }); }
  todas() { return this.repo.list(); }
}
