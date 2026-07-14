/**
 * Etapa 14 — Release Report Service.
 * Consolida o estado do Framework Fiscal em um relatório executivo estruturado.
 * Não executa efeito colateral: apenas agrega dados de outros módulos.
 */

export interface CriterioCertificacao {
  criterio: string;
  atendido: boolean;
  evidencia?: string;
}

export interface RiscoResidual {
  id: string;
  descricao: string;
  severidade: 'baixa' | 'media' | 'alta';
  mitigacao?: string;
}

export interface RelatorioRelease {
  versao: string;
  data: string;
  etapas: number;
  totalTestes: number;
  testesPassando: number;
  adrsVigentes: number;
  modulos: string[];
  criterios: CriterioCertificacao[];
  riscos: RiscoResidual[];
  aptoParaHomologacao: boolean;
  parecer: string;
}

export interface EntradaRelatorio {
  versao: string;
  totalTestes: number;
  testesPassando: number;
  adrsVigentes: number;
  modulos: string[];
  criterios: CriterioCertificacao[];
  riscos: RiscoResidual[];
  etapas: number;
}

export class ReleaseReportService {
  gerar(input: EntradaRelatorio): RelatorioRelease {
    const criteriosOk = input.criterios.every((c) => c.atendido);
    const testesOk = input.totalTestes > 0 && input.testesPassando === input.totalTestes;
    const semRiscoAlto = !input.riscos.some((r) => r.severidade === 'alta' && !r.mitigacao);
    const apto = criteriosOk && testesOk && semRiscoAlto;
    return {
      versao: input.versao,
      data: new Date().toISOString(),
      etapas: input.etapas,
      totalTestes: input.totalTestes,
      testesPassando: input.testesPassando,
      adrsVigentes: input.adrsVigentes,
      modulos: [...input.modulos],
      criterios: input.criterios,
      riscos: input.riscos,
      aptoParaHomologacao: apto,
      parecer: apto
        ? `Framework Fiscal AVIZEE ${input.versao} — APTO para homologação funcional e preparação para produção.`
        : `Framework Fiscal AVIZEE ${input.versao} — pendências devem ser resolvidas antes da homologação.`,
    };
  }
}

/** Baseline oficial da Release 1.0 — espelha docs/fiscal-framework/etapa-14/10-relatorio-executivo.md. */
export const RELEASE_1_0_BASELINE: EntradaRelatorio = {
  versao: '1.0.0',
  etapas: 14,
  totalTestes: 105,
  testesPassando: 105,
  adrsVigentes: 17,
  modulos: [
    'core', 'infrastructure', 'nfe', 'nfe/eventos',
    'recebimento', 'escrituracao', 'operacional',
    'homologacao', 'compliance', 'platform',
  ],
  criterios: [
    { criterio: 'Todos os módulos documentados', atendido: true },
    { criterio: 'Todos os serviços com testes', atendido: true, evidencia: '105/105' },
    { criterio: 'Todas as APIs com contratos', atendido: true },
    { criterio: 'Todos os eventos registrados', atendido: true, evidencia: 'FiscalEventBus' },
    { criterio: 'Toda integração documentada', atendido: true },
    { criterio: 'Todas as dependências catalogadas', atendido: true },
    { criterio: 'Aderência aos 17 ADRs', atendido: true },
  ],
  riscos: [
    { id: 'R1', descricao: 'Layouts NFC-e/CT-e/MDF-e/NFS-e/BP-e/NF3-e pendentes', severidade: 'media', mitigacao: 'Plataforma de plugins pronta (Etapa 13)' },
    { id: 'R2', descricao: 'SPED completo pendente de layouts oficiais', severidade: 'media', mitigacao: 'Base SPED e SpedLayoutRegistry disponíveis' },
    { id: 'R3', descricao: 'Reforma Tributária depende de regulamentação final', severidade: 'media', mitigacao: 'Camada de coexistência disponível (Etapa 12)' },
    { id: 'R4', descricao: 'Certificado A1 gerenciado pelo cliente', severidade: 'media', mitigacao: 'Alertas de expiração automáticos' },
    { id: 'R5', descricao: 'Fontes oficiais de NT ainda não integradas automaticamente', severidade: 'baixa', mitigacao: 'MonitorRegulatorioService recebe entradas manuais' },
  ],
};
