/**
 * Bootstrap do módulo Fiscal. Registra provedores e devolve o container.
 * Etapa 4: apenas infraestrutura — nenhuma operação SEFAZ.
 */
import { createContainer, type FiscalContainer } from './container';

let instance: FiscalContainer | null = null;

export function bootstrapFiscal(): FiscalContainer {
  if (!instance) instance = createContainer();
  return instance;
}

export function resetFiscal(): void {
  instance = null;
}
