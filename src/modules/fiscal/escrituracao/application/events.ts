export const ESCRITURACAO_EVENTS = [
  'fiscal.escrituracao.periodo.aberto',
  'fiscal.escrituracao.periodo.em_apuracao',
  'fiscal.escrituracao.periodo.apurado',
  'fiscal.escrituracao.periodo.fechado',
  'fiscal.escrituracao.periodo.reaberto',
  'fiscal.escrituracao.consolidacao.executada',
  'fiscal.escrituracao.apuracao.executada',
  'fiscal.escrituracao.livro.gerado',
  'fiscal.escrituracao.inconsistencia.detectada',
  'fiscal.escrituracao.parametro.atualizado',
  'fiscal.escrituracao.sped.preparado',
] as const;

export type EscrituracaoEventName = (typeof ESCRITURACAO_EVENTS)[number];
