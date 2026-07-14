import type { DescritorValidador, DocumentoFiscalCodigo, ResultadoValidacao } from '../types';

export class ValidadorRegistry {
  private data = new Map<DocumentoFiscalCodigo, DescritorValidador[]>();
  register(v: DescritorValidador) {
    const arr = this.data.get(v.documento) ?? [];
    arr.push(v);
    this.data.set(v.documento, arr);
  }
  list(doc: DocumentoFiscalCodigo) { return [...(this.data.get(doc) ?? [])]; }
  async runAll(doc: DocumentoFiscalCodigo, input: unknown): Promise<ResultadoValidacao> {
    const validadores = this.list(doc);
    const erros: ResultadoValidacao['erros'] = [];
    const avisos: NonNullable<ResultadoValidacao['avisos']> = [];
    for (const v of validadores) {
      const r = await v.run(input);
      erros.push(...r.erros);
      if (r.avisos) avisos.push(...r.avisos);
    }
    return { ok: erros.length === 0, erros, avisos };
  }
}
