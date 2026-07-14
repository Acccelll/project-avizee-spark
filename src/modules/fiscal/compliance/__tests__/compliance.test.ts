import { describe, it, expect } from 'vitest';
import {
  bootstrapComplianceEngine,
  calculadorAliquotaSimples,
  ROADMAP_PADRAO,
} from '../index';

const iso = (y: number, m = 1, d = 1) => new Date(Date.UTC(y, m - 1, d)).toISOString();

describe('Etapa 12 — Compliance Engine', () => {
  it('registra normas, artefatos e resolve versão vigente', async () => {
    const c = bootstrapComplianceEngine();
    await c.versionamento.registrarNorma({
      id: 'nt-2024-001', fonte: 'nota_tecnica', numero: '2024.001', esfera: 'federal',
      ementa: 'NT NF-e', publicacao: iso(2024, 6, 1), vigencia: { inicio: iso(2024, 9, 1) },
    });
    await c.versionamento.registrarArtefato({
      id: 'nfe.autorizacao', categoria: 'layout_xml', chave: 'nfe.autorizacao.v4',
      descricao: 'NF-e autorização', ativo: true,
    });
    await c.versionamento.registrarVersao({
      id: 'nfe.autorizacao@4.00', artefatoId: 'nfe.autorizacao', categoria: 'layout_xml',
      versao: '4.00', vigencia: { inicio: iso(2018) },
    });
    const v = await c.versionamento.vigente('nfe.autorizacao');
    expect(v?.versao).toBe('4.00');
  });

  it('coexistência de tributos: modelo atual + reforma', async () => {
    const c = bootstrapComplianceEngine();
    await c.tributoRegistry.registrar({
      id: 'icms', nome: 'ICMS', esfera: 'estadual', modelo: 'atual',
      vigencia: { inicio: iso(1988), fim: iso(2033) },
      parametros: { aliquota: 18 }, incidencia: ['saida', 'entrada'],
    });
    await c.tributoRegistry.registrar({
      id: 'ibs', nome: 'IBS', esfera: 'estadual', modelo: 'reforma',
      vigencia: { inicio: iso(2026) }, parametros: { aliquota: 12 },
    });
    const ctx = await c.reforma.contextoTransicao(iso(2027));
    expect(ctx.modo).toBe('coexistencia');
    expect(ctx.atual.some((t) => t.id === 'icms')).toBe(true);
    expect(ctx.reforma.some((t) => t.id === 'ibs')).toBe(true);
  });

  it('motor tributário abstrato calcula qualquer tributo registrado', async () => {
    const c = bootstrapComplianceEngine();
    await c.tributoRegistry.registrar({
      id: 'cbs', nome: 'CBS', esfera: 'federal', modelo: 'reforma',
      vigencia: { inicio: iso(2026) }, parametros: { aliquota: 8.8 },
    });
    c.motorAbstrato.registrar('cbs', calculadorAliquotaSimples);
    const vigentes = await c.tributoRegistry.vigentes(iso(2027));
    const r = c.motorAbstrato.calcular(vigentes, { baseCalculo: 1000 });
    expect(r[0].valor).toBeCloseTo(88, 2);
  });

  it('governança versiona configurações e faz rollback', async () => {
    const c = bootstrapComplianceEngine();
    await c.governanca.registrar('motor.icms.base', { aliquota: 18 }, 'ana');
    await c.governanca.registrar('motor.icms.base', { aliquota: 20 }, 'ana');
    const v2 = await c.governanca.vigente<{ aliquota: number }>('motor.icms.base');
    expect(v2?.versao).toBe(2);
    const back = await c.governanca.rollback('motor.icms.base', 1, 'ana');
    expect(back.versao).toBe(3);
    expect((back.valor as { aliquota: number }).aliquota).toBe(18);
  });

  it('engine de compatibilidade emite alertas por versão divergente e certificado vencido', async () => {
    const c = bootstrapComplianceEngine();
    await c.versionamento.registrarArtefato({ id: 'nfe.autorizacao', categoria: 'layout_xml', chave: 'nfe.autorizacao.v4', descricao: '', ativo: true });
    await c.versionamento.registrarVersao({
      id: 'v4', artefatoId: 'nfe.autorizacao', categoria: 'layout_xml',
      versao: '4.00', vigencia: { inicio: iso(2018) }, compatibilidadeCom: ['3.10'],
    });
    const alertas = await c.compatibilidade.validar({
      empresaId: 'e1', artefatoId: 'nfe.autorizacao', versaoUsada: '3.10',
      certificadoValidoAte: iso(2020),
    });
    expect(alertas.some((a) => a.nivel === 'medio')).toBe(true);
    expect(alertas.some((a) => a.nivel === 'critico')).toBe(true);
  });

  it('monitor regulatório rastreia pendências e atualizações', async () => {
    const c = bootstrapComplianceEngine();
    const m = await c.monitorRegulatorio.registrar({
      id: 'm1', titulo: 'NT 2025.001', descricao: 'Ajuste layout NF-e',
      impacto: 'alto', modulosAfetados: ['nfe'], status: 'identificada',
    });
    expect((await c.monitorRegulatorio.pendencias()).length).toBe(1);
    await c.monitorRegulatorio.atualizarStatus(m.id, 'concluida');
    expect((await c.monitorRegulatorio.pendencias()).length).toBe(0);
  });

  it('centro de atualizações bloqueia atualização sem versão registrada', async () => {
    const c = bootstrapComplianceEngine();
    await c.versionamento.registrarArtefato({ id: 'nfe.autorizacao', categoria: 'layout_xml', chave: 'k', descricao: '', ativo: true });
    const pre = await c.centroAtualizacoes.preValidar({ artefatoId: 'nfe.autorizacao', versaoAlvo: '9.99', requerAprovacao: false });
    expect(pre.ok).toBe(false);
  });

  it('roadmap padrão contém itens críticos: SPED e Reforma', async () => {
    const c = bootstrapComplianceEngine();
    await c.roadmap.seedPadrao();
    const list = await c.roadmap.listar();
    expect(list.length).toBe(ROADMAP_PADRAO.length);
    expect(list.find((i) => i.chave === 'reforma')?.prioridade).toBe('critico');
  });

  it('indicadores de observabilidade agregam artefatos, tributos e pendências', async () => {
    const c = bootstrapComplianceEngine();
    await c.versionamento.registrarArtefato({ id: 'a1', categoria: 'xsd', chave: 'k', descricao: '', ativo: true });
    await c.versionamento.registrarVersao({ id: 'a1v1', artefatoId: 'a1', categoria: 'xsd', versao: '1.0', vigencia: { inicio: iso(2020) } });
    await c.tributoRegistry.registrar({ id: 'pis', nome: 'PIS', esfera: 'federal', modelo: 'atual', vigencia: { inicio: iso(2000) }, parametros: {} });
    const ind = await c.observabilidade.indicadores();
    expect(ind.artefatosAtivos).toBe(1);
    expect(ind.versoesTotais).toBe(1);
    expect(ind.tributosVigentes).toBe(1);
  });

  it('runner de migração reverte passos aplicados quando ocorre erro', async () => {
    const c = bootstrapComplianceEngine();
    void c;
    const { MigracaoRunner } = await import('../application/migracaoStrategy');
    const log: string[] = [];
    const runner = new MigracaoRunner();
    const res = await runner.executar([
      { id: 'p1', descricao: '', apply: async () => { log.push('a1'); }, rollback: async () => { log.push('r1'); } },
      { id: 'p2', descricao: '', apply: async () => { throw new Error('boom'); }, rollback: async () => { log.push('r2'); } },
    ]);
    expect(res.aplicados).toEqual(['p1']);
    expect(res.revertidos).toEqual(['p1']);
    expect(res.erro).toContain('boom');
  });

  it('suíte de compatibilidade executa múltiplos ambientes', async () => {
    const c = bootstrapComplianceEngine();
    await c.versionamento.registrarArtefato({ id: 'nfe.autorizacao', categoria: 'layout_xml', chave: 'k', descricao: '', ativo: true });
    await c.versionamento.registrarVersao({ id: 'v', artefatoId: 'nfe.autorizacao', categoria: 'layout_xml', versao: '4.00', vigencia: { inicio: iso(2018) } });
    const res = await c.suiteCompatibilidade.executar({
      id: 'cen-1', descricao: 'multi-empresa',
      ambientes: [
        { empresaId: 'e1', artefatoId: 'nfe.autorizacao', versaoUsada: '4.00' },
        { empresaId: 'e2', artefatoId: 'nfe.autorizacao', versaoUsada: '3.10' },
      ],
    });
    expect(res.totalAmbientes).toBe(2);
    expect(res.criticos + res.altos + res.medios).toBeGreaterThan(0);
  });
});
