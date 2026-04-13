const noop = () => undefined;

export const logger = {
  log: import.meta.env.PROD ? noop : (message: string, ...args: unknown[]) => console.log(message, ...args),
  info: import.meta.env.PROD ? noop : (message: string, ...args: unknown[]) => console.info(message, ...args),
  warn: import.meta.env.PROD ? noop : (message: string, ...args: unknown[]) => console.warn(message, ...args),
  debug: import.meta.env.PROD ? noop : (message: string, ...args: unknown[]) => console.debug(message, ...args),
  error: (message: string, ...args: unknown[]) => console.error(message, ...args),
};

export default logger;
