/**
 * Etapa 12 — Entidades do Compliance Engine.
 * Versionadas e agnósticas a tributo específico, permitindo modelo atual
 * (ICMS/IPI/PIS/COFINS/ISS) e Reforma Tributária (IBS/CBS/IS) simultaneamente.
 */

export type EsferaLegal = 'federal' | 'estadual' | 'municipal';

export type FonteLegal =
  | 'nota_tecnica'
  | 'ajuste_sinief'
  | 'convenio_icms'
  | 'protocolo_icms'
  | 'ato_cotepe'
  | 'lei_complementar'
  | 'decreto'
  | 'instrucao_normativa'
  | 'portaria'
  | 'outra';

export type CategoriaArtefato =
  | 'layout_xml'
  | 'xsd'
  | 'webservice'
  | 'endpoint'
  | 'schema_sped'
  | 'evento_fiscal'
  | 'protocolo'
  | 'regra_tributaria';

export interface VigenciaLegal {
  inicio: string;
  fim?: string;
  transicaoAte?: string;
}

export interface NormaLegal {
  id: string;
  fonte: FonteLegal;
  numero: string;
  esfera: EsferaLegal;
  uf?: string;
  municipioIbge?: string;
  ementa: string;
  publicacao: string;
  vigencia: VigenciaLegal;
  url?: string;
  tags?: string[];
}

export interface Artefato {
  id: string;
  categoria: CategoriaArtefato;
  chave: string;
  descricao: string;
  ativo: boolean;
}

export interface VersaoArtefato {
  id: string;
  artefatoId: string;
  categoria: CategoriaArtefato;
  versao: string;
  vigencia: VigenciaLegal;
  compatibilidadeCom?: string[];
  dependencias?: string[];
  normaIds?: string[];
  checksum?: string;
  descricao?: string;
}

export type ModeloTributario = 'atual' | 'reforma' | 'coexistencia';

export interface TributoDefinicao {
  id: string;
  nome: string;
  esfera: EsferaLegal;
  modelo: ModeloTributario;
  vigencia: VigenciaLegal;
  parametros: Record<string, unknown>;
  incidencia?: string[];
  dependencias?: string[];
  substituiIds?: string[];
  coexisteComIds?: string[];
}

export type NivelImpacto = 'baixo' | 'medio' | 'alto' | 'critico';

export type StatusMudanca =
  | 'identificada'
  | 'em_analise'
  | 'planejada'
  | 'em_implementacao'
  | 'homologacao'
  | 'concluida'
  | 'descartada';

export interface MudancaRegulatoria {
  id: string;
  normaId?: string;
  titulo: string;
  descricao: string;
  impacto: NivelImpacto;
  modulosAfetados: string[];
  responsaveis?: string[];
  status: StatusMudanca;
  prazoAdequacao?: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ConfiguracaoVersao<T = unknown> {
  id: string;
  chave: string;
  versao: number;
  valor: T;
  autor: string;
  aprovadoPor?: string;
  aprovadoEm?: string;
  vigenciaInicio: string;
  vigenciaFim?: string;
  descricao?: string;
}

export interface AlertaCompatibilidade {
  id: string;
  artefatoId: string;
  versao: string;
  nivel: NivelImpacto;
  motivo: string;
  detectadoEm: string;
}

export interface RoadmapItem {
  chave: string;
  titulo: string;
  descricao: string;
  dependencias: string[];
  prioridade: NivelImpacto;
  status: 'planejado' | 'em_andamento' | 'concluido';
  previsao?: string;
}
