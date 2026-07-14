import type {
  IArtefatoRepository,
  INormaRepository,
  ITributoRepository,
  IMudancaRepository,
  IConfiguracaoVersionadaRepository,
  IRoadmapRepository,
  IAlertaCompatibilidadeSink,
} from '../application/contracts';
import type {
  Artefato,
  VersaoArtefato,
  NormaLegal,
  TributoDefinicao,
  MudancaRegulatoria,
  ConfiguracaoVersao,
  RoadmapItem,
  AlertaCompatibilidade,
  StatusMudanca,
} from '../domain/entities';

function isVigente(v: { inicio: string; fim?: string }, refIso: string): boolean {
  return v.inicio <= refIso && (!v.fim || v.fim > refIso);
}

export class InMemoryArtefatoRepository implements IArtefatoRepository {
  private artefatos = new Map<string, Artefato>();
  private versoes = new Map<string, VersaoArtefato[]>();

  async upsertArtefato(a: Artefato): Promise<void> {
    this.artefatos.set(a.id, a);
  }
  async getArtefato(id: string): Promise<Artefato | null> {
    return this.artefatos.get(id) ?? null;
  }
  async listArtefatos(filtro?: { categoria?: string; ativo?: boolean }): Promise<Artefato[]> {
    return Array.from(this.artefatos.values()).filter(
      (a) =>
        (!filtro?.categoria || a.categoria === filtro.categoria) &&
        (filtro?.ativo === undefined || a.ativo === filtro.ativo),
    );
  }
  async upsertVersao(v: VersaoArtefato): Promise<void> {
    const arr = this.versoes.get(v.artefatoId) ?? [];
    const idx = arr.findIndex((x) => x.id === v.id);
    if (idx >= 0) arr[idx] = v;
    else arr.push(v);
    this.versoes.set(v.artefatoId, arr);
  }
  async listVersoes(artefatoId: string): Promise<VersaoArtefato[]> {
    return [...(this.versoes.get(artefatoId) ?? [])];
  }
  async getVersaoVigente(artefatoId: string, refIso = new Date().toISOString()): Promise<VersaoArtefato | null> {
    const list = this.versoes.get(artefatoId) ?? [];
    return list.find((v) => isVigente(v.vigencia, refIso)) ?? null;
  }
}

export class InMemoryNormaRepository implements INormaRepository {
  private data = new Map<string, NormaLegal>();
  async upsert(n: NormaLegal) { this.data.set(n.id, n); }
  async get(id: string) { return this.data.get(id) ?? null; }
  async list(filtro?: { esfera?: string; uf?: string; fonte?: string }): Promise<NormaLegal[]> {
    return Array.from(this.data.values()).filter(
      (n) =>
        (!filtro?.esfera || n.esfera === filtro.esfera) &&
        (!filtro?.uf || n.uf === filtro.uf) &&
        (!filtro?.fonte || n.fonte === filtro.fonte),
    );
  }
}

export class InMemoryTributoRepository implements ITributoRepository {
  private data = new Map<string, TributoDefinicao>();
  async upsert(t: TributoDefinicao) { this.data.set(t.id, t); }
  async get(id: string) { return this.data.get(id) ?? null; }
  async list(filtro?: { modelo?: string; esfera?: string }): Promise<TributoDefinicao[]> {
    return Array.from(this.data.values()).filter(
      (t) =>
        (!filtro?.modelo || t.modelo === filtro.modelo) &&
        (!filtro?.esfera || t.esfera === filtro.esfera),
    );
  }
  async listVigentes(refIso = new Date().toISOString()) {
    return Array.from(this.data.values()).filter((t) => isVigente(t.vigencia, refIso));
  }
}

export class InMemoryMudancaRepository implements IMudancaRepository {
  private data = new Map<string, MudancaRegulatoria>();
  async upsert(m: MudancaRegulatoria) { this.data.set(m.id, m); }
  async get(id: string) { return this.data.get(id) ?? null; }
  async list(filtro?: { status?: StatusMudanca; modulo?: string }) {
    return Array.from(this.data.values()).filter(
      (m) =>
        (!filtro?.status || m.status === filtro.status) &&
        (!filtro?.modulo || m.modulosAfetados.includes(filtro.modulo)),
    );
  }
}

export class InMemoryConfiguracaoVersionadaRepository implements IConfiguracaoVersionadaRepository {
  private data = new Map<string, ConfiguracaoVersao[]>();
  async registrar<T>(cfg: ConfiguracaoVersao<T>): Promise<void> {
    const arr = (this.data.get(cfg.chave) ?? []) as ConfiguracaoVersao[];
    arr.push(cfg as ConfiguracaoVersao);
    arr.sort((a, b) => a.versao - b.versao);
    this.data.set(cfg.chave, arr);
  }
  async historico(chave: string) { return [...(this.data.get(chave) ?? [])]; }
  async vigente<T>(chave: string, refIso = new Date().toISOString()): Promise<ConfiguracaoVersao<T> | null> {
    const arr = this.data.get(chave) ?? [];
    const vigentes = arr.filter(
      (c) => c.vigenciaInicio <= refIso && (!c.vigenciaFim || c.vigenciaFim > refIso),
    );
    return (vigentes[vigentes.length - 1] as ConfiguracaoVersao<T>) ?? null;
  }
}

export class InMemoryRoadmapRepository implements IRoadmapRepository {
  private data = new Map<string, RoadmapItem>();
  async upsert(item: RoadmapItem) { this.data.set(item.chave, item); }
  async list() { return Array.from(this.data.values()); }
}

export class InMemoryAlertaCompatibilidadeSink implements IAlertaCompatibilidadeSink {
  private data: AlertaCompatibilidade[] = [];
  async publish(a: AlertaCompatibilidade) { this.data.push(a); }
  async list() { return [...this.data]; }
}
