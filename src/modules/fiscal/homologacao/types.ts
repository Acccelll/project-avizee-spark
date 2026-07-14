/**
 * Etapa 11 — Homologação técnica, hardening e certificação.
 * Tipos consumidos pela suíte E2E e pelo gerador de relatórios.
 */

export type FluxoHomologado =
  | 'emissao_nfe'
  | 'consulta_nfe'
  | 'cancelamento_nfe'
  | 'carta_correcao'
  | 'inutilizacao'
  | 'manifestacao_destinatario'
  | 'distribuicao_dfe'
  | 'download_xml'
  | 'recebimento_xml'
  | 'integracao_erp'
  | 'consolidacao_fiscal'
  | 'apuracao_tributaria'
  | 'fechamento_periodo';

export interface ResultadoFluxo {
  fluxo: FluxoHomologado;
  sucesso: boolean;
  duracaoMs: number;
  erros: string[];
  observacoes?: string[];
}

export interface CargaResultado {
  totalDocumentos: number;
  concorrencia: number;
  duracaoTotalMs: number;
  throughputPorSegundo: number;
  falhas: number;
}

export interface RecuperacaoResultado {
  cenario: string;
  disparouRetry: boolean;
  recuperado: boolean;
  tentativas: number;
  duracaoMs: number;
}

export interface HardeningItem {
  categoria: 'auth' | 'rls' | 'cripto' | 'certificado' | 'logs' | 'secrets' | 'exposicao' | 'exceptions';
  item: string;
  ok: boolean;
  observacao?: string;
}

export interface RelatorioHomologacao {
  geradoEm: string;
  arquitetura: { pontosFortes: string[]; limitacoes: string[]; melhorias: string[] };
  performance: {
    metricas: Record<string, number>;
    benchmarks: CargaResultado[];
    gargalosCorrigidos: string[];
  };
  seguranca: {
    riscos: string[];
    correcoes: string[];
    recomendacoes: string[];
    checklist: HardeningItem[];
  };
  testes: {
    cobertura: number;
    cenarios: ResultadoFluxo[];
    falhasCorrigidas: string[];
  };
  producao: {
    checklist: Array<{ item: string; ok: boolean }>;
    riscosResiduais: string[];
    recomendacoesFinais: string[];
    aptoParaHomologacao: boolean;
  };
}
