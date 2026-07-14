import type { DescritorIntegracao, IntegracaoAdapter } from '../types';

export class IntegracaoRegistry {
  private data = new Map<string, DescritorIntegracao>();
  private cache = new Map<string, IntegracaoAdapter>();
  register(i: DescritorIntegracao) { this.data.set(i.id, i); }
  get(id: string) { return this.data.get(id) ?? null; }
  list(tipo?: DescritorIntegracao['tipo']) {
    const arr = Array.from(this.data.values());
    return tipo ? arr.filter((i) => i.tipo === tipo) : arr;
  }
  /** Descobre e materializa o adapter (cache para reuso). */
  resolve(id: string): IntegracaoAdapter | null {
    const desc = this.data.get(id);
    if (!desc) return null;
    let ad = this.cache.get(id);
    if (!ad) { ad = desc.adapter(); this.cache.set(id, ad); }
    return ad;
  }
}
