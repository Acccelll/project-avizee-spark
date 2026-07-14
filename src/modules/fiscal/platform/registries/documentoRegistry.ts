import type { PluginDocumentoFiscal, DocumentoFiscalCodigo, Capacidade } from '../types';

export class DocumentoRegistry {
  private data = new Map<DocumentoFiscalCodigo, PluginDocumentoFiscal>();
  register(p: PluginDocumentoFiscal) {
    if (this.data.has(p.codigo)) throw new Error(`Documento já registrado: ${p.codigo}`);
    this.data.set(p.codigo, p);
  }
  get(codigo: DocumentoFiscalCodigo) { return this.data.get(codigo) ?? null; }
  list() { return Array.from(this.data.values()); }
  suportam(cap: Capacidade) {
    return this.list().filter((d) => d.capacidades.includes(cap));
  }
  has(codigo: DocumentoFiscalCodigo) { return this.data.has(codigo); }
  unregister(codigo: DocumentoFiscalCodigo) { this.data.delete(codigo); }
}
