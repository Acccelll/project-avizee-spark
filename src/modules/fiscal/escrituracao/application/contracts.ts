import type {
  ApuracaoPeriodo,
  DocumentoConsolidado,
  InconsistenciaFiscal,
  LivroFiscal,
  ParametroTributario,
  PeriodoFiscal,
  RegimeTributario,
} from '../domain/entities';

export interface IPeriodoRepository {
  buscar(empresaId: string, ano: number, mes: number): Promise<PeriodoFiscal | null>;
  salvar(periodo: PeriodoFiscal): Promise<PeriodoFiscal>;
  atualizarStatus(id: string, patch: Partial<PeriodoFiscal>): Promise<PeriodoFiscal>;
}

export interface IDocumentoConsolidadoRepository {
  listarPorPeriodo(periodoId: string): Promise<DocumentoConsolidado[]>;
  upsertLote(docs: DocumentoConsolidado[]): Promise<number>;
}

export interface IParametroTributarioRepository {
  listar(empresaId: string, tributo?: string): Promise<ParametroTributario[]>;
  upsert(param: ParametroTributario): Promise<ParametroTributario>;
}

export interface IApuracaoRepository {
  salvar(apuracao: ApuracaoPeriodo): Promise<void>;
  buscarPorPeriodo(periodoId: string): Promise<ApuracaoPeriodo | null>;
}

export interface IInconsistenciasRepository {
  registrarLote(items: InconsistenciaFiscal[]): Promise<void>;
  listar(periodoId: string): Promise<InconsistenciaFiscal[]>;
}

export interface ILivroFiscalRepository {
  salvar(livro: LivroFiscal): Promise<void>;
}

export interface IRegimeProvider {
  regimeDe(empresaId: string, data: string): Promise<RegimeTributario>;
}

export interface EscrituracaoDeps {
  periodos: IPeriodoRepository;
  documentos: IDocumentoConsolidadoRepository;
  parametros: IParametroTributarioRepository;
  apuracoes: IApuracaoRepository;
  inconsistencias: IInconsistenciasRepository;
  livros: ILivroFiscalRepository;
  regime: IRegimeProvider;
}
