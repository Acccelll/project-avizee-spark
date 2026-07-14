import type { CertificadoInfo } from '../types';

export interface ICertificadoRepo {
  listar(empresaId?: string): Promise<CertificadoInfo[]>;
  registrar(info: CertificadoInfo): Promise<CertificadoInfo>;
  desativar(id: string): Promise<void>;
}

export class CertificadoService {
  constructor(private readonly repo: ICertificadoRepo) {}

  async proximosDoVencimento(diasLimite = 30, empresaId?: string): Promise<CertificadoInfo[]> {
    const items = await this.repo.listar(empresaId);
    const limite = Date.now() + diasLimite * 86_400_000;
    return items.filter((c) => c.ativo && new Date(c.validoAte).getTime() <= limite);
  }

  diasParaVencer(info: Pick<CertificadoInfo, 'validoAte'>, ref = new Date()): number {
    const diff = new Date(info.validoAte).getTime() - ref.getTime();
    return Math.floor(diff / 86_400_000);
  }
}
