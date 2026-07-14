import type {
  ApuracaoPeriodo,
  DocumentoConsolidado,
  InconsistenciaFiscal,
  LivroFiscal,
  ParametroTributario,
  PeriodoFiscal,
  RegimeTributario,
} from '../domain/entities';
import type {
  IApuracaoRepository,
  IDocumentoConsolidadoRepository,
  IInconsistenciasRepository,
  ILivroFiscalRepository,
  IParametroTributarioRepository,
  IPeriodoRepository,
  IRegimeProvider,
} from '../application/contracts';

/** Implementações in-memory — usadas em testes e como referência. */

export class InMemoryPeriodoRepository implements IPeriodoRepository {
  private store = new Map<string, PeriodoFiscal>();
  async buscar(empresaId: string, ano: number, mes: number): Promise<PeriodoFiscal | null> {
    for (const p of this.store.values()) {
      if (p.empresaId === empresaId && p.ano === ano && p.mes === mes) return p;
    }
    return null;
  }
  async salvar(p: PeriodoFiscal): Promise<PeriodoFiscal> {
    this.store.set(p.id, p);
    return p;
  }
  async atualizarStatus(id: string, patch: Partial<PeriodoFiscal>): Promise<PeriodoFiscal> {
    const atual = this.store.get(id);
    if (!atual) throw new Error(`Período ${id} não encontrado`);
    const novo = { ...atual, ...patch };
    this.store.set(id, novo);
    return novo;
  }
}

export class InMemoryDocumentoConsolidadoRepository implements IDocumentoConsolidadoRepository {
  private store = new Map<string, DocumentoConsolidado>();
  async listarPorPeriodo(periodoId: string): Promise<DocumentoConsolidado[]> {
    return [...this.store.values()].filter((d) => d.periodoId === periodoId);
  }
  async upsertLote(docs: DocumentoConsolidado[]): Promise<number> {
    for (const d of docs) this.store.set(d.id, d);
    return docs.length;
  }
}

export class InMemoryParametroRepository implements IParametroTributarioRepository {
  private store: ParametroTributario[] = [];
  async listar(empresaId: string): Promise<ParametroTributario[]> {
    return this.store.filter((p) => p.empresaId === empresaId);
  }
  async upsert(p: ParametroTributario): Promise<ParametroTributario> {
    const idx = this.store.findIndex((x) => x.id === p.id);
    if (idx >= 0) this.store[idx] = p;
    else this.store.push(p);
    return p;
  }
}

export class InMemoryApuracaoRepository implements IApuracaoRepository {
  private store = new Map<string, ApuracaoPeriodo>();
  async salvar(a: ApuracaoPeriodo): Promise<void> { this.store.set(a.periodoId, a); }
  async buscarPorPeriodo(id: string): Promise<ApuracaoPeriodo | null> { return this.store.get(id) ?? null; }
}

export class InMemoryInconsistenciasRepository implements IInconsistenciasRepository {
  private store: InconsistenciaFiscal[] = [];
  async registrarLote(items: InconsistenciaFiscal[]): Promise<void> { this.store.push(...items); }
  async listar(periodoId: string): Promise<InconsistenciaFiscal[]> {
    return this.store.filter((i) => i.periodoId === periodoId);
  }
}

export class InMemoryLivroRepository implements ILivroFiscalRepository {
  livros: LivroFiscal[] = [];
  async salvar(l: LivroFiscal): Promise<void> { this.livros.push(l); }
}

export class StaticRegimeProvider implements IRegimeProvider {
  constructor(private readonly regime: RegimeTributario) {}
  async regimeDe(): Promise<RegimeTributario> { return this.regime; }
}
