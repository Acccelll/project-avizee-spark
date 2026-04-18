import { useEffect, useState } from "react";

/**
 * useDrawerData — padroniza fetch de dados secundários em drawers.
 *
 * Resolve dois problemas recorrentes:
 *  1. Race condition ao trocar rapidamente de registro com o drawer aberto:
 *     o resultado do fetch antigo sobrescrevia o estado do registro novo.
 *  2. Estado "vazado" entre registros: ao mudar `selectedId`, o `data`
 *     anterior continuava visível até o novo terminar de carregar.
 *
 * - Não dispara fetch quando `!open || !selectedId`.
 * - Reseta `data` para `null` imediatamente quando `selectedId` muda.
 * - Cancela o fetch via `AbortSignal` quando o efeito é descartado.
 *   (Loaders que não suportam signal ainda funcionam — usamos um `cancelled`
 *   flag local como segunda barreira.)
 */
export function useDrawerData<T>(
  open: boolean,
  selectedId: string | null | undefined,
  loader: (id: string, signal: AbortSignal) => Promise<T>,
): { data: T | null; loading: boolean; error: Error | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!open || !selectedId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);
    // Reset data assim que o id muda — evita exibir conteúdo do registro anterior.
    setData(null);

    loader(selectedId, controller.signal)
      .then((result) => {
        if (cancelled || controller.signal.aborted) return;
        setData(result);
      })
      .catch((err) => {
        if (cancelled || controller.signal.aborted) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (cancelled || controller.signal.aborted) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedId, nonce]);

  return { data, loading, error, reload: () => setNonce((n) => n + 1) };
}
