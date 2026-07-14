import type { DescritorLayout, DocumentoFiscalCodigo } from '../types';

/** Registry de layouts da plataforma — suporta múltiplas versões coexistentes. */
export class PlatformLayoutRegistry {
  private data = new Map<string, DescritorLayout>(); // key: `${chave}@${versao}`
  register(l: DescritorLayout) { this.data.set(`${l.chave}@${l.versao}`, l); }
  get(chave: string, versao: string) { return this.data.get(`${chave}@${versao}`) ?? null; }
  listByChave(chave: string) {
    return Array.from(this.data.values()).filter((l) => l.chave === chave);
  }
  listByDocumento(doc: DocumentoFiscalCodigo) {
    return Array.from(this.data.values()).filter((l) => l.documento === doc);
  }
  all() { return Array.from(this.data.values()); }
}
