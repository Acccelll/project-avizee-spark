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

export interface IArtefatoRepository {
  upsertArtefato(a: Artefato): Promise<void>;
  getArtefato(id: string): Promise<Artefato | null>;
  listArtefatos(filtro?: { categoria?: string; ativo?: boolean }): Promise<Artefato[]>;
  upsertVersao(v: VersaoArtefato): Promise<void>;
  listVersoes(artefatoId: string): Promise<VersaoArtefato[]>;
  getVersaoVigente(artefatoId: string, refIso?: string): Promise<VersaoArtefato | null>;
}

export interface INormaRepository {
  upsert(n: NormaLegal): Promise<void>;
  get(id: string): Promise<NormaLegal | null>;
  list(filtro?: { esfera?: string; uf?: string; fonte?: string }): Promise<NormaLegal[]>;
}

export interface ITributoRepository {
  upsert(t: TributoDefinicao): Promise<void>;
  get(id: string): Promise<TributoDefinicao | null>;
  list(filtro?: { modelo?: string; esfera?: string }): Promise<TributoDefinicao[]>;
  listVigentes(refIso?: string): Promise<TributoDefinicao[]>;
}

export interface IMudancaRepository {
  upsert(m: MudancaRegulatoria): Promise<void>;
  get(id: string): Promise<MudancaRegulatoria | null>;
  list(filtro?: { status?: StatusMudanca; modulo?: string }): Promise<MudancaRegulatoria[]>;
}

export interface IConfiguracaoVersionadaRepository {
  registrar<T>(cfg: ConfiguracaoVersao<T>): Promise<void>;
  historico(chave: string): Promise<ConfiguracaoVersao[]>;
  vigente<T>(chave: string, refIso?: string): Promise<ConfiguracaoVersao<T> | null>;
}

export interface IRoadmapRepository {
  upsert(item: RoadmapItem): Promise<void>;
  list(): Promise<RoadmapItem[]>;
}

export interface IAlertaCompatibilidadeSink {
  publish(a: AlertaCompatibilidade): Promise<void>;
  list(): Promise<AlertaCompatibilidade[]>;
}
