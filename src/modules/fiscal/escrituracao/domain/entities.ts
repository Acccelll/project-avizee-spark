/**
 * Etapa 9 — Domínio de Escrituração Fiscal.
 * Entidades puras, sem dependências de infraestrutura.
 */

export type RegimeTributario =
  | 'simples_nacional'
  | 'lucro_presumido'
  | 'lucro_real'
  | 'mei';

export type Tributo =
  | 'ICMS'
  | 'ICMS_ST'
  | 'IPI'
  | 'PIS'
  | 'COFINS'
  | 'ISS'
  | 'DIFAL'
  | 'FCP'
  | 'IRRF'
  | 'CSLL'
  | 'INSS';

export type TipoOperacao = 'entrada' | 'saida';

export type StatusPeriodo = 'aberto' | 'em_apuracao' | 'apurado' | 'fechado' | 'reaberto';

export interface PeriodoFiscal {
  id: string;
  empresaId: string;
  ano: number;
  mes: number; // 1..12
  status: StatusPeriodo;
  fechadoEm?: string;
  fechadoPor?: string;
  versao: number;
}

export interface DocumentoConsolidado {
  id: string;
  empresaId: string;
  periodoId: string;
  tipo: 'nfe' | 'nfce' | 'cte' | 'nfse' | 'evento' | 'inutilizacao' | 'manifestacao';
  operacao: TipoOperacao;
  chave?: string;
  numero?: string;
  serie?: string;
  dataEmissao: string;
  cfop?: string;
  cst?: string;
  csosn?: string;
  ncm?: string;
  cest?: string;
  valorTotal: number;
  baseIcms?: number;
  valorIcms?: number;
  baseIcmsSt?: number;
  valorIcmsSt?: number;
  valorIpi?: number;
  valorPis?: number;
  valorCofins?: number;
  valorIss?: number;
  situacao: 'valido' | 'cancelado' | 'inutilizado' | 'denegado';
}

export interface ParametroTributario {
  id: string;
  empresaId: string;
  tributo: Tributo;
  regime: RegimeTributario;
  chave: string; // ex: `CFOP:5102|NCM:12345678|UF:SP`
  aliquota: number;
  reducaoBase?: number;
  isento?: boolean;
  beneficio?: string;
  vigenciaInicio: string;
  vigenciaFim?: string;
  metadata?: Record<string, unknown>;
}

export interface ResultadoCalculoTributo {
  tributo: Tributo;
  base: number;
  aliquota: number;
  reducao?: number;
  valor: number;
  isento: boolean;
  origem: 'parametro' | 'documento' | 'ajuste';
  parametroId?: string;
  detalhes?: Record<string, unknown>;
}

export interface ApuracaoTributo {
  tributo: Tributo;
  debitos: number;
  creditos: number;
  ajustes: number;
  saldoAnterior: number;
  saldoAPagar: number;
  saldoCredor: number;
  detalhamento: ResultadoCalculoTributo[];
}

export interface ApuracaoPeriodo {
  periodoId: string;
  empresaId: string;
  geradoEm: string;
  tributos: ApuracaoTributo[];
  totalDebitos: number;
  totalCreditos: number;
  totalAPagar: number;
}

export interface InconsistenciaFiscal {
  id: string;
  periodoId: string;
  documentoId?: string;
  tipo:
    | 'documento_sem_integracao'
    | 'tributo_inconsistente'
    | 'cadastro_incompleto'
    | 'cfop_incompativel'
    | 'cst_invalido'
    | 'diferenca_tributaria'
    | 'divergencia_xml_erp'
    | 'pendencia_fiscal';
  severidade: 'baixa' | 'media' | 'alta' | 'critica';
  mensagem: string;
  detectadoEm: string;
  detalhes?: Record<string, unknown>;
}

export interface LivroFiscal {
  tipo: 'entradas' | 'saidas' | 'inventario' | 'apuracao_icms' | 'apuracao_ipi';
  periodoId: string;
  empresaId: string;
  layout: string;
  linhas: Record<string, unknown>[];
  geradoEm: string;
}
