import type { DescritorWorkflow, DocumentoFiscalCodigo, Capacidade, ContextoWorkflow } from '../types';

export class WorkflowRegistry {
  private data = new Map<string, DescritorWorkflow>();
  register(w: DescritorWorkflow) { this.data.set(`${w.documento}:${w.capacidade}`, w); }
  get(doc: DocumentoFiscalCodigo, cap: Capacidade) {
    return this.data.get(`${doc}:${cap}`) ?? null;
  }
  list(doc?: DocumentoFiscalCodigo) {
    const arr = Array.from(this.data.values());
    return doc ? arr.filter((w) => w.documento === doc) : arr;
  }
}

/** Executor genérico de workflow com compensação (saga). */
export class WorkflowExecutor {
  async run(wf: DescritorWorkflow, ctx: ContextoWorkflow): Promise<{ ok: boolean; erro?: string; executados: string[]; compensados: string[] }> {
    const executados: string[] = [];
    try {
      for (const p of wf.passos) {
        await p.execute(ctx);
        executados.push(p.id);
      }
      return { ok: true, executados, compensados: [] };
    } catch (e) {
      const compensados: string[] = [];
      for (const id of [...executados].reverse()) {
        const p = wf.passos.find((x) => x.id === id);
        try { if (p?.compensate) { await p.compensate(ctx); compensados.push(id); } } catch { /* segue */ }
      }
      return { ok: false, erro: e instanceof Error ? e.message : String(e), executados, compensados };
    }
  }
}
