/**
 * Logger fiscal — wrapper sobre o logger central do projeto.
 * Sempre carrega correlationId quando disponível.
 */
import { logger } from '@/lib/logger';

export interface FiscalLogContext {
  correlationId?: string;
  empresaId?: string;
  documento?: string;
  chaveAcesso?: string;
  [k: string]: unknown;
}

export interface FiscalLogger {
  debug(message: string, ctx?: FiscalLogContext): void;
  info(message: string, ctx?: FiscalLogContext): void;
  warn(message: string, ctx?: FiscalLogContext): void;
  error(message: string, ctx?: FiscalLogContext): void;
}

function withScope(ctx?: FiscalLogContext) {
  return { scope: 'fiscal', ...ctx };
}

export const fiscalLogger: FiscalLogger = {
  debug: (m, c) => logger.debug(m, withScope(c)),
  info: (m, c) => logger.info(m, withScope(c)),
  warn: (m, c) => logger.warn(m, withScope(c)),
  error: (m, c) => logger.error(m, withScope(c)),
};
