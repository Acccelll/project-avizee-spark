import type { DescritorServico, DocumentoFiscalCodigo, Capacidade } from '../types';

export class ServicoRegistry {
  private data = new Map<string, DescritorServico>(); // key `${doc}:${nome}@${versao}`
  register(s: DescritorServico) {
    this.data.set(`${s.documento}:${s.nome}@${s.versao}`, s);
  }
  resolve(doc: DocumentoFiscalCodigo, nome: string, versao?: string) {
    if (versao) return this.data.get(`${doc}:${nome}@${versao}`) ?? null;
    const candidatos = this.list(doc).filter((s) => s.nome === nome);
    candidatos.sort((a, b) => (a.versao < b.versao ? 1 : -1));
    return candidatos[0] ?? null;
  }
  list(doc?: DocumentoFiscalCodigo) {
    const arr = Array.from(this.data.values());
    return doc ? arr.filter((s) => s.documento === doc) : arr;
  }
  descobrirPorCapacidade(cap: Capacidade) {
    return this.list().filter((s) => s.capacidades.includes(cap));
  }
}
