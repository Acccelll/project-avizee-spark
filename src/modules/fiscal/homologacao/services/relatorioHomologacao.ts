import type {
  CargaResultado,
  HardeningItem,
  RelatorioHomologacao,
  ResultadoFluxo,
} from '../types';

export interface RelatorioInput {
  arquitetura: RelatorioHomologacao['arquitetura'];
  metricas: Record<string, number>;
  benchmarks: CargaResultado[];
  gargalosCorrigidos: string[];
  hardening: HardeningItem[];
  riscosSeguranca: string[];
  correcoesSeguranca: string[];
  recomendacoesSeguranca: string[];
  cobertura: number;
  cenarios: ResultadoFluxo[];
  falhasCorrigidas: string[];
  producaoChecklist: Array<{ item: string; ok: boolean }>;
  riscosResiduais: string[];
  recomendacoesFinais: string[];
}

export class RelatorioHomologacaoService {
  gerar(input: RelatorioInput): RelatorioHomologacao {
    const cenariosOk = input.cenarios.every((c) => c.sucesso);
    const hardeningOk = input.hardening.every((h) => h.ok);
    const cargaOk = input.benchmarks.every((b) => b.falhas === 0);
    const producaoOk = input.producaoChecklist.every((c) => c.ok);
    const aptoParaHomologacao =
      cenariosOk && hardeningOk && cargaOk && producaoOk && input.cobertura >= 0.7;

    return {
      geradoEm: new Date().toISOString(),
      arquitetura: input.arquitetura,
      performance: {
        metricas: input.metricas,
        benchmarks: input.benchmarks,
        gargalosCorrigidos: input.gargalosCorrigidos,
      },
      seguranca: {
        riscos: input.riscosSeguranca,
        correcoes: input.correcoesSeguranca,
        recomendacoes: input.recomendacoesSeguranca,
        checklist: input.hardening,
      },
      testes: {
        cobertura: input.cobertura,
        cenarios: input.cenarios,
        falhasCorrigidas: input.falhasCorrigidas,
      },
      producao: {
        checklist: input.producaoChecklist,
        riscosResiduais: input.riscosResiduais,
        recomendacoesFinais: input.recomendacoesFinais,
        aptoParaHomologacao,
      },
    };
  }
}
