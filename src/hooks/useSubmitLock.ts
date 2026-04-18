import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

export interface UseSubmitLockOptions {
  /** Mostra toast.error automaticamente ao falhar. Default: true. */
  toastOnError?: boolean;
  /** Prefixo da mensagem de erro. Default: "Erro ao salvar". */
  errorPrefix?: string;
}

export interface UseSubmitLockApi {
  saving: boolean;
  /**
   * Executa `fn` com lock. Garante que:
   *  - chamadas concorrentes são ignoradas (retornam null);
   *  - `saving` volta a false em qualquer caminho (try/finally);
   *  - exceções viram toast.error (configurável) e são re-lançadas para o caller decidir.
   */
  submit: <R>(fn: () => Promise<R>) => Promise<R | null>;
}

/**
 * Hook utilitário para padronizar submit handlers:
 *  - estado `saving` para desabilitar botão
 *  - prevenção de duplo envio via ref síncrona
 *  - try/finally que sempre libera o lock
 *  - tratamento de erro padronizado (toast)
 */
export function useSubmitLock(opts: UseSubmitLockOptions = {}): UseSubmitLockApi {
  const { toastOnError = true, errorPrefix = "Erro ao salvar" } = opts;
  const [saving, setSaving] = useState(false);
  const lockRef = useRef(false);

  const submit = useCallback(
    async <R,>(fn: () => Promise<R>): Promise<R | null> => {
      if (lockRef.current) return null;
      lockRef.current = true;
      setSaving(true);
      try {
        return await fn();
      } catch (err) {
        if (toastOnError) {
          const msg = err instanceof Error ? err.message : String(err);
          toast.error(`${errorPrefix}: ${msg}`);
        }
        throw err;
      } finally {
        lockRef.current = false;
        setSaving(false);
      }
    },
    [toastOnError, errorPrefix],
  );

  return { saving, submit };
}
