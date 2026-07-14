import type { NotificacaoCategoria, NotificacaoFiscal } from '../types';

export interface INotificacaoRepository {
  registrar(n: NotificacaoFiscal): Promise<NotificacaoFiscal>;
  listar(filtro?: { empresaId?: string; nãoLidas?: boolean }): Promise<NotificacaoFiscal[]>;
  marcarLida(id: string): Promise<void>;
}

export interface INotificacaoCanal {
  nome: 'app' | 'email' | 'push' | 'webhook';
  enviar(n: NotificacaoFiscal): Promise<void>;
}

export class NotificacoesFiscaisService {
  constructor(
    private readonly repo: INotificacaoRepository,
    private readonly canais: INotificacaoCanal[] = [],
  ) {}

  async emitir(input: Omit<NotificacaoFiscal, 'id' | 'criadoEm'> & { id?: string }): Promise<NotificacaoFiscal> {
    const n: NotificacaoFiscal = {
      id: input.id ?? crypto.randomUUID(),
      criadoEm: new Date().toISOString(),
      empresaId: input.empresaId,
      categoria: input.categoria,
      titulo: input.titulo,
      mensagem: input.mensagem,
      severidade: input.severidade,
      canais: input.canais,
      dados: input.dados,
    };
    await this.repo.registrar(n);
    const alvos = this.canais.filter((c) => n.canais.includes(c.nome));
    await Promise.allSettled(alvos.map((c) => c.enviar(n)));
    return n;
  }

  categoriaDeEvento(evento: string): NotificacaoCategoria {
    if (evento.startsWith('fiscal.nfe')) return 'nfe';
    if (evento.includes('certificado')) return 'certificado';
    if (evento.includes('sefaz')) return 'sefaz';
    if (evento.includes('escrituracao')) return 'apuracao';
    if (evento.includes('queue') || evento.includes('processamento')) return 'processamento';
    return 'inconsistencia';
  }
}
