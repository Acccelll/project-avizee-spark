import type {
  IArtefatoRepository,
  ITributoRepository,
  IMudancaRepository,
  IAlertaCompatibilidadeSink,
} from './contracts';

export interface IndicadoresRegulatorios {
  artefatosAtivos: number;
  versoesTotais: number;
  tributosVigentes: number;
  pendenciasRegulatorias: number;
  alertasCompatibilidade: number;
  refIso: string;
}

export class ObservabilidadeRegulatoriaService {
  constructor(
    private readonly artefatos: IArtefatoRepository,
    private readonly tributos: ITributoRepository,
    private readonly mudancas: IMudancaRepository,
    private readonly alertas: IAlertaCompatibilidadeSink,
  ) {}

  async indicadores(refIso = new Date().toISOString()): Promise<IndicadoresRegulatorios> {
    const artefatosAtivos = (await this.artefatos.listArtefatos({ ativo: true })).length;
    const list = await this.artefatos.listArtefatos();
    let versoesTotais = 0;
    for (const a of list) versoesTotais += (await this.artefatos.listVersoes(a.id)).length;
    const tributosVigentes = (await this.tributos.listVigentes(refIso)).length;
    const pendenciasRegulatorias =
      (await this.mudancas.list({ status: 'identificada' })).length +
      (await this.mudancas.list({ status: 'em_analise' })).length;
    const alertasCompatibilidade = (await this.alertas.list()).length;
    return { artefatosAtivos, versoesTotais, tributosVigentes, pendenciasRegulatorias, alertasCompatibilidade, refIso };
  }
}
