/** Retorno da RPC `workbook_fechamento_dados(p_competencia)`. */
export interface FechamentoSocioMes {
  saldo?: number;
  prolabore?: number;
  fonte?: string;
}

export interface FechamentoMes {
  /** AAAA-MM */
  competencia: string;
  /** Mês até a competência pedida (inclusive). Meses posteriores vêm vazios. */
  fechado: boolean;
  valores: Partial<Record<FechamentoMetrica, number>>;
  fontes: Partial<Record<FechamentoMetrica, 'erp' | 'historico' | 'manual'>>;
  /** Chave = socio_id. */
  socios: Record<string, FechamentoSocioMes>;
}

export interface FechamentoSocio {
  id: string;
  nome: string;
  nome_exibicao: string;
  /** Percentual (0–100). */
  percentual: number;
}

export interface FechamentoParametrosAno {
  crescimento_meta: number;
  limite_faturamento: number;
}

/** Um mês da carteira: pedidos sem nota e títulos em aberto na data-base, por mês. */
export interface CarteiraMes {
  /** AAAA-MM */
  mes: string;
  /** Pedidos confirmados sem nota com faturamento previsto no mês (null sem carteira informada). */
  backlog: number | null;
  /** Títulos a receber em aberto na data-base com vencimento no mês. */
  receber: number;
  /** Títulos a pagar em aberto na data-base com vencimento no mês. */
  pagar: number;
}

/** Fotografia da carteira na data-base (fim da competência) e os 4 meses seguintes. */
export interface CarteiraFechamento {
  data_base: string;
  /** Há carteira informada no fechamento da competência. */
  informada: boolean;
  meses: CarteiraMes[];
  backlog_depois: number;
  receber_vencido: number;
  pagar_vencido: number;
  receber_depois: number;
  pagar_depois: number;
}

export interface FechamentoDados {
  competencia: string;
  ano: number;
  /** Resultado de caixa acumulado antes de dez/(ano-3). */
  saldo_caixa_anterior: number;
  /** Carteira de pedidos e títulos em aberto da competência (ausente em dados antigos). */
  carteira?: CarteiraFechamento;
  /** 37 meses: dez/(ano-3) .. dez/ano. */
  meses: FechamentoMes[];
  socios: FechamentoSocio[];
  /** Chave = ano (string). */
  parametros: Record<string, FechamentoParametrosAno>;
}

export const AGING_FAIXAS = [
  'av_0_30', 'av_31_60', 'av_61_90', 'av_90p',
  'vc_0_30', 'vc_31_60', 'vc_61_90', 'vc_91_120', 'vc_121_180', 'vc_181_360', 'vc_360p',
] as const;

export type FechamentoMetrica =
  | 'receita_caixa'
  /** Rendimentos de aplicações recebidos no mês (conta 6.1.2); já estão em receita_caixa. */
  | 'rendimentos'
  /** Carteira que o fechamento do mês anterior previa faturar neste mês. */
  | 'backlog_previsto'
  | 'despesa_caixa'
  | 'faturamento'
  | 'bloqueado'
  | 'estoque_materiais'
  | 'estoque_produtos'
  | 'seguidores_linkedin'
  | 'seguidores_instagram'
  /** Caixa final informado (extrato) menos o calculado: o ajuste ao extrato do mês. */
  | 'ajuste_caixa'
  /** Caixa no fim do mês: o informado no fechamento ou, sem ele, o calculado. */
  | 'caixa_final'
  /** Caixa no fim do mês pelo ERP, antes do ajuste do próprio mês. */
  | 'caixa_final_calculado'
  | `aging_cr_${(typeof AGING_FAIXAS)[number]}`
  | `aging_cp_${(typeof AGING_FAIXAS)[number]}`;

/** Métricas digitadas no fechamento (não calculadas pelo ERP). */
export const METRICAS_MANUAIS = ['seguidores_linkedin', 'seguidores_instagram', 'caixa_final', 'bloqueado'] as const;
