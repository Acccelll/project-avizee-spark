/**
 * Etapa 13 — Fiscal Platform (arquitetura de plugins).
 *
 * O núcleo aqui é agnóstico de documento fiscal. NF-e permanece em
 * `src/modules/fiscal/nfe/` e continua funcionando sem regressões; futuros
 * documentos (NFC-e, CT-e, MDF-e, BP-e, NF3-e, NFS-e, ...) devem ser
 * implementados como plugins usando o SDK abaixo.
 */
export * from './types';
export * from './platform';
export * from './registries/documentoRegistry';
export * from './registries/layoutRegistry';
export * from './registries/servicoRegistry';
export * from './registries/validadorRegistry';
export * from './registries/builderRegistry';
export * from './registries/eventoRegistry';
export * from './registries/integracaoRegistry';
export * from './registries/workflowRegistry';
export * as sdk from './sdk';
export { FDocPlugin } from './template/exemplo-fdoc.plugin';
