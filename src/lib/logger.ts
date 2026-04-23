/**
 * Logger gated por ambiente.
 *
 * Em produção, todas as chamadas `console.*` são removidas pelo
 * `esbuild.drop` configurado em `vite.config.ts`. Este wrapper
 * serve apenas para dev: mantém rastreabilidade local sem expor
 * stack traces no bundle final, e preserva semântica para
 * eventual integração futura com sink remoto.
 */
const isDev = import.meta.env.DEV;

export const logger = {
  error: (...args: unknown[]) => { if (isDev) console.error(...args); },
  warn:  (...args: unknown[]) => { if (isDev) console.warn(...args); },
  info:  (...args: unknown[]) => { if (isDev) console.info(...args); },
};
