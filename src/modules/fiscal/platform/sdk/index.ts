/**
 * SDK interno para novos documentos fiscais.
 * Fornece helpers com defaults corretos e tipagem estrita.
 */
import type {
  PluginDocumentoFiscal,
  DescritorLayout,
  DescritorServico,
  DescritorValidador,
  DescritorBuilder,
  DescritorEvento,
  DescritorIntegracao,
  DescritorWorkflow,
  ResultadoValidacao,
  DocumentoFiscalCodigo,
} from '../types';

export function definePlugin(p: PluginDocumentoFiscal): PluginDocumentoFiscal { return p; }
export function defineLayout(l: DescritorLayout): DescritorLayout { return l; }
export function defineServico(s: DescritorServico): DescritorServico { return s; }
export function defineValidador<T = unknown>(v: DescritorValidador<T>) { return v; }
export function defineBuilder<I = unknown, O = unknown>(b: DescritorBuilder<I, O>) { return b; }
export function defineEvento(e: DescritorEvento): DescritorEvento { return e; }
export function defineIntegracao(i: DescritorIntegracao): DescritorIntegracao { return i; }
export function defineWorkflow(w: DescritorWorkflow): DescritorWorkflow { return w; }

export const ok = (): ResultadoValidacao => ({ ok: true, erros: [] });
export const fail = (codigo: string, mensagem: string, campo?: string): ResultadoValidacao => ({
  ok: false, erros: [{ codigo, mensagem, campo }],
});

export type { PluginDocumentoFiscal, DocumentoFiscalCodigo };
