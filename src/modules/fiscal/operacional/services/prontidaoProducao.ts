import type { RelatorioProntidao } from '../types';

export interface ProntidaoInput {
  arquiteturaOk: boolean;
  segurancaOk: boolean;
  desempenhoOk: boolean;
  observabilidadeOk: boolean;
  cobertura: number; // 0..1
  documentacaoOk: boolean;
  integracoesOk: boolean;
  bancoOk: boolean;
  migracoesOk: boolean;
  filasOk: boolean;
  cacheOk: boolean;
  logsOk: boolean;
  permissoesOk: boolean;
}

export class ProntidaoProducaoService {
  gerar(input: ProntidaoInput): RelatorioProntidao {
    const checklist: RelatorioProntidao['checklist'] = [
      { item: 'Arquitetura modular e Clean Architecture preservadas', ok: input.arquiteturaOk },
      { item: 'Segurança (RLS, secrets, RBAC granular)', ok: input.segurancaOk },
      { item: 'Performance (índices, cache, filas)', ok: input.desempenhoOk },
      { item: 'Observabilidade (métricas, tracing, logs)', ok: input.observabilidadeOk },
      { item: `Cobertura de testes ≥ 70% (atual ${(input.cobertura * 100).toFixed(1)}%)`, ok: input.cobertura >= 0.7 },
      { item: 'Documentação técnica e operacional atualizada', ok: input.documentacaoOk },
      { item: 'Integrações com ERP validadas', ok: input.integracoesOk },
      { item: 'Banco e migrações consistentes', ok: input.bancoOk && input.migracoesOk },
      { item: 'Filas e cache configurados', ok: input.filasOk && input.cacheOk },
      { item: 'Logs estruturados e sem PII', ok: input.logsOk },
      { item: 'Catálogo de permissões aplicado', ok: input.permissoesOk },
    ];
    const concluidos = checklist.filter((c) => c.ok).map((c) => c.item);
    const pendentes = checklist.filter((c) => !c.ok).map((c) => c.item);
    return {
      geradoEm: new Date().toISOString(),
      concluidos,
      pendentes,
      riscos: pendentes.length
        ? ['Itens pendentes bloqueiam entrada em produção plena — validar em ambiente de homologação.']
        : [],
      recomendacoes: [
        'Executar carga de longa duração antes do go-live.',
        'Configurar alertas para certificados a vencer em ≤ 30 dias.',
        'Habilitar rotina de reconsulta automática de pendências.',
      ],
      checklist,
    };
  }
}
