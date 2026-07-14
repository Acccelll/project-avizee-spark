import type { DescritorBuilder, DocumentoFiscalCodigo } from '../types';

export class BuilderRegistry {
  private data = new Map<string, DescritorBuilder>(); // key `${doc}:${id}`
  register(b: DescritorBuilder) { this.data.set(`${b.documento}:${b.id}`, b); }
  get(doc: DocumentoFiscalCodigo, id: string) { return this.data.get(`${doc}:${id}`) ?? null; }
  list(doc?: DocumentoFiscalCodigo) {
    const arr = Array.from(this.data.values());
    return doc ? arr.filter((b) => b.documento === doc) : arr;
  }
}
