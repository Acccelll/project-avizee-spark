import type { DescritorEvento } from '../types';

export class EventoRegistry {
  private data = new Map<string, DescritorEvento>();
  register(e: DescritorEvento) { this.data.set(e.nome, e); }
  get(nome: string) { return this.data.get(nome) ?? null; }
  list(filtro?: { documento?: string; categoria?: DescritorEvento['categoria'] }) {
    return Array.from(this.data.values()).filter(
      (e) =>
        (!filtro?.documento || e.documento === filtro.documento) &&
        (!filtro?.categoria || e.categoria === filtro.categoria),
    );
  }
}
