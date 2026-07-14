/**
 * Monitor Fiscal — agrega snapshots dos documentos recebidos para
 * dashboards. Sem cache/persistência próprios; consome o repositório.
 */
import type { IDocumentoRecebidoRepository } from './contracts';
import type { DocumentoRecebido, StatusRecebimento } from '../domain/entities';

export interface MonitorSnapshot {
  total: number;
  porStatus: Record<StatusRecebimento, number>;
  porOrigem: Record<string, number>;
  duplicados: number;
  invalidos: number;
  pendentes: number;
  ultimos24h: number;
}

export interface IMonitorRepositoryExt extends IDocumentoRecebidoRepository {
  listRecentes(empresaId: string, limite: number): Promise<DocumentoRecebido[]>;
}

const STATUS_ZERO: Record<StatusRecebimento, number> = {
  recebido: 0, em_validacao: 0, validado: 0, invalido: 0, duplicado: 0,
  em_conciliacao: 0, pendente_aprovacao: 0, integrado: 0, rejeitado: 0,
  reprocessando: 0, arquivado: 0,
};

export class MonitorFiscal {
  constructor(private repo: IMonitorRepositoryExt) {}

  async snapshot(empresaId: string, janela = 500): Promise<MonitorSnapshot> {
    const docs = await this.repo.listRecentes(empresaId, janela);
    const porStatus: Record<StatusRecebimento, number> = { ...STATUS_ZERO };
    const porOrigem: Record<string, number> = {};
    let duplicados = 0, invalidos = 0, pendentes = 0, ultimos24h = 0;
    const limite24h = Date.now() - 24 * 60 * 60 * 1000;
    for (const d of docs) {
      porStatus[d.status] = (porStatus[d.status] ?? 0) + 1;
      porOrigem[d.origem] = (porOrigem[d.origem] ?? 0) + 1;
      if (d.status === 'duplicado') duplicados++;
      if (d.status === 'invalido') invalidos++;
      if (d.status === 'pendente_aprovacao') pendentes++;
      if (new Date(d.recebidoEm).getTime() >= limite24h) ultimos24h++;
    }
    return { total: docs.length, porStatus, porOrigem, duplicados, invalidos, pendentes, ultimos24h };
  }
}