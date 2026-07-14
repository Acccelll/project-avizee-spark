/**
 * Etapa 12 — Compliance Engine, versionamento legal, registries de layouts e
 * tributos, preparação para a Reforma Tributária e roadmap de evolução.
 */
export * from './domain/entities';
export * from './application/contracts';
export * from './application/versionamentoLegal';
export * from './application/layoutRegistry';
export * from './application/tributoRegistry';
export * from './application/reformaTributaria';
export * from './application/motorTributarioAbstrato';
export * from './application/compatibilidadeEngine';
export * from './application/governancaConfiguracoes';
export * from './application/monitorRegulatorio';
export * from './application/centroAtualizacoes';
export * from './application/migracaoStrategy';
export * from './application/observabilidadeRegulatoria';
export * from './application/testesCompatibilidade';
export * from './application/roadmap';
export * from './application/events';
export * from './infrastructure/inMemoryRepositories';

import {
  InMemoryArtefatoRepository,
  InMemoryNormaRepository,
  InMemoryTributoRepository,
  InMemoryMudancaRepository,
  InMemoryConfiguracaoVersionadaRepository,
  InMemoryRoadmapRepository,
  InMemoryAlertaCompatibilidadeSink,
} from './infrastructure/inMemoryRepositories';
import { VersionamentoLegalService } from './application/versionamentoLegal';
import { LayoutRegistry } from './application/layoutRegistry';
import { TributoRegistry } from './application/tributoRegistry';
import { ReformaTributariaService } from './application/reformaTributaria';
import { CompatibilidadeEngine } from './application/compatibilidadeEngine';
import { GovernancaConfiguracoesService } from './application/governancaConfiguracoes';
import { MonitorRegulatorioService } from './application/monitorRegulatorio';
import { CentroAtualizacoesService } from './application/centroAtualizacoes';
import { ObservabilidadeRegulatoriaService } from './application/observabilidadeRegulatoria';
import { SuiteCompatibilidade } from './application/testesCompatibilidade';
import { RoadmapService } from './application/roadmap';
import { MotorTributarioAbstrato } from './application/motorTributarioAbstrato';

/** Bootstrap padrão em memória — pronto para ser substituído por adapters (Supabase). */
export function bootstrapComplianceEngine() {
  const artefatos = new InMemoryArtefatoRepository();
  const normas = new InMemoryNormaRepository();
  const tributos = new InMemoryTributoRepository();
  const mudancas = new InMemoryMudancaRepository();
  const configs = new InMemoryConfiguracaoVersionadaRepository();
  const roadmap = new InMemoryRoadmapRepository();
  const alertas = new InMemoryAlertaCompatibilidadeSink();

  return {
    repos: { artefatos, normas, tributos, mudancas, configs, roadmap, alertas },
    versionamento: new VersionamentoLegalService(artefatos, normas),
    layoutRegistry: new LayoutRegistry(artefatos),
    tributoRegistry: new TributoRegistry(tributos),
    reforma: new ReformaTributariaService(tributos),
    compatibilidade: new CompatibilidadeEngine(artefatos, alertas),
    governanca: new GovernancaConfiguracoesService(configs),
    monitorRegulatorio: new MonitorRegulatorioService(mudancas),
    centroAtualizacoes: new CentroAtualizacoesService(artefatos),
    observabilidade: new ObservabilidadeRegulatoriaService(artefatos, tributos, mudancas, alertas),
    suiteCompatibilidade: new SuiteCompatibilidade(new CompatibilidadeEngine(artefatos, alertas)),
    roadmap: new RoadmapService(roadmap),
    motorAbstrato: new MotorTributarioAbstrato(),
  };
}

export type ComplianceEngineContainer = ReturnType<typeof bootstrapComplianceEngine>;
