import { describe, it, expect } from 'vitest';
import { ReleaseReportService, RELEASE_1_0_BASELINE } from '../releaseReport';

describe('Etapa 14 — Release 1.0', () => {
  it('gera relatório APTO com a baseline oficial', () => {
    const r = new ReleaseReportService().gerar(RELEASE_1_0_BASELINE);
    expect(r.versao).toBe('1.0.0');
    expect(r.etapas).toBe(14);
    expect(r.aptoParaHomologacao).toBe(true);
    expect(r.parecer).toMatch(/APTO/);
    expect(r.modulos).toContain('platform');
  });

  it('reprova quando algum critério não é atendido', () => {
    const svc = new ReleaseReportService();
    const r = svc.gerar({
      ...RELEASE_1_0_BASELINE,
      criterios: [...RELEASE_1_0_BASELINE.criterios, { criterio: 'Cobertura mínima', atendido: false }],
    });
    expect(r.aptoParaHomologacao).toBe(false);
  });

  it('reprova quando existe risco alto sem mitigação', () => {
    const svc = new ReleaseReportService();
    const r = svc.gerar({
      ...RELEASE_1_0_BASELINE,
      riscos: [{ id: 'X', descricao: 'crítico', severidade: 'alta' }],
    });
    expect(r.aptoParaHomologacao).toBe(false);
  });

  it('reprova quando testes não passam integralmente', () => {
    const svc = new ReleaseReportService();
    const r = svc.gerar({ ...RELEASE_1_0_BASELINE, testesPassando: 100 });
    expect(r.aptoParaHomologacao).toBe(false);
  });
});
