/**
 * Barramento interno de eventos fiscais (in-process).
 * Persistência/relay para webhooks vem em etapa posterior.
 */
export type FiscalEventName =
  | 'fiscal.endpoint.updated'
  | 'fiscal.config.updated'
  | 'fiscal.certificado.registrado'
  | 'fiscal.certificado.expira_em_breve'
  | 'fiscal.auditoria.registrada'
  | 'fiscal.queue.job_enqueued'
  | 'fiscal.queue.job_failed'
  // Etapa 6 — eventos NF-e (fato passado, ADR-017)
  | 'fiscal.nfe.criada'
  | 'fiscal.nfe.validada'
  | 'fiscal.nfe.assinada'
  | 'fiscal.nfe.transmitida'
  | 'fiscal.nfe.autorizada'
  | 'fiscal.nfe.rejeitada'
  | 'fiscal.nfe.denegada'
  | 'fiscal.nfe.persistida'
  | 'fiscal.nfe.atualizada'
  | 'fiscal.nfe.consultada'
  // Etapa 7 — eventos, DF-e, manifestação, sincronização
  | 'fiscal.nfe.cancelamento.solicitado'
  | 'fiscal.nfe.cancelamento.homologado'
  | 'fiscal.nfe.cancelamento.rejeitado'
  | 'fiscal.nfe.cce.transmitida'
  | 'fiscal.nfe.cce.homologada'
  | 'fiscal.nfe.cce.rejeitada'
  | 'fiscal.nfe.inutilizacao.solicitada'
  | 'fiscal.nfe.inutilizacao.homologada'
  | 'fiscal.nfe.inutilizacao.rejeitada'
  | 'fiscal.nfe.manifestacao.transmitida'
  | 'fiscal.nfe.manifestacao.homologada'
  | 'fiscal.nfe.recibo.consultado'
  | 'fiscal.nfe.protocolo.consultado'
  | 'fiscal.nfe.distdfe.consultado'
  | 'fiscal.nfe.distdfe.documento_recebido'
  | 'fiscal.nfe.xml.baixado'
  | 'fiscal.nfe.status.sincronizado'
  // Etapa 8 — recebimento fiscal
  | 'fiscal.recebimento.xml.recebido'
  | 'fiscal.recebimento.xml.duplicado'
  | 'fiscal.recebimento.xml.invalido'
  | 'fiscal.recebimento.xml.validado'
  | 'fiscal.recebimento.lote.iniciado'
  | 'fiscal.recebimento.lote.progresso'
  | 'fiscal.recebimento.lote.finalizado'
  | 'fiscal.recebimento.conciliacao.executada'
  | 'fiscal.recebimento.pendente_aprovacao'
  | 'fiscal.recebimento.integrado.compras'
  | 'fiscal.recebimento.integrado.estoque'
  | 'fiscal.recebimento.integrado.financeiro'
  | 'fiscal.recebimento.aprovado'
  | 'fiscal.recebimento.rejeitado'
  | 'fiscal.recebimento.reprocessado';

export interface FiscalEvent<T = unknown> {
  name: FiscalEventName;
  correlationId?: string;
  empresaId?: string;
  timestamp: string;
  payload: T;
}

type Handler = (ev: FiscalEvent) => void | Promise<void>;

export class FiscalEventBus {
  private handlers = new Map<FiscalEventName, Set<Handler>>();

  on(name: FiscalEventName, handler: Handler): () => void {
    if (!this.handlers.has(name)) this.handlers.set(name, new Set());
    this.handlers.get(name)!.add(handler);
    return () => this.handlers.get(name)?.delete(handler);
  }

  async emit<T>(name: FiscalEventName, payload: T, meta: { correlationId?: string; empresaId?: string } = {}): Promise<void> {
    const ev: FiscalEvent<T> = { name, payload, timestamp: new Date().toISOString(), ...meta };
    const list = this.handlers.get(name);
    if (!list) return;
    await Promise.allSettled(Array.from(list).map((h) => h(ev as FiscalEvent)));
  }
}
