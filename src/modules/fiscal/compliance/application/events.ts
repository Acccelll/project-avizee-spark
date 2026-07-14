/**
 * Nomes canônicos dos eventos publicados pelo Compliance Engine.
 * Todos ficam sob o prefixo `fiscal.compliance.*`.
 */
export const ComplianceEventNames = [
  'fiscal.compliance.norma.registrada',
  'fiscal.compliance.artefato.versionado',
  'fiscal.compliance.tributo.registrado',
  'fiscal.compliance.configuracao.versionada',
  'fiscal.compliance.mudanca.registrada',
  'fiscal.compliance.mudanca.status_atualizado',
  'fiscal.compliance.alerta.emitido',
  'fiscal.compliance.migracao.aplicada',
  'fiscal.compliance.migracao.revertida',
  'fiscal.compliance.roadmap.atualizado',
] as const;

export type ComplianceEventName = typeof ComplianceEventNames[number];
