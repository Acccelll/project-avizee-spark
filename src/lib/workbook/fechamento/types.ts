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

export interface FechamentoDados {
  competencia: string;
  ano: number;
  /** Resultado de caixa acumulado antes de dez/(ano-3). */
  saldo_caixa_anterior: number;
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
  | 'despesa_caixa'
  | 'faturamento'
  | 'bloqueado'
  | 'estoque_materiais'
  | 'estoque_produtos'
  | 'seguidores_linkedin'
  | 'seguidores_instagram'
  | `aging_cr_${(typeof AGING_FAIXAS)[number]}`
  | `aging_cp_${(typeof AGING_FAIXAS)[number]}`;

/** Métricas digitadas no fechamento (não calculadas pelo ERP). */
export const METRICAS_MANUAIS = ['seguidores_linkedin', 'seguidores_instagram'] as const;
