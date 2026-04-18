import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useDetailFetch — padroniza o fetch das *Views relacionais* (ClienteView,
 * OrcamentoView, OrdemVendaView, etc.).
 *
 * Resolve três problemas recorrentes nessas Views:
 *
 *  1. **Race condition ao trocar `id` rapidamente** — o resultado do fetch
 *     antigo podia chegar depois do novo e sobrescrever o estado correto.
 *     Aqui usamos `AbortController` + flag `cancelled` (dupla barreira para
 *     loaders que não respeitam o signal).
 *
 *  2. **Loading eterno em paths de erro/early-return** — várias Views faziam
 *     `if (!data) return;` antes do `setLoading(false)`. Aqui o `loading`
 *     SEMPRE volta a `false` ao final, independente do caminho.
 *
 *  3. **Reset de estado entre ids** — ao mudar o `id`, o `data` anterior
 *     ficava visível até o novo terminar. Resetamos `data` para `null`
 *     imediatamente quando o `id` muda.
 *
 * O `loader` recebe `(id, signal)` e deve devolver os dados já no formato
 * desejado (combine múltiplos `await` lá dentro). Erros são capturados e
 * expostos via `error`. Não aplica toast — quem chama decide.
 */
export function useDetailFetch<T>(
  id: string | null | undefined,
  loader: (id: string, signal: AbortSignal) => Promise<T | null>,
): {
  data: T | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
  setData: (updater: T | null | ((prev: T | null) => T | null)) => void;
} {
  const [data, setDataState] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(id));
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  // Usamos ref para evitar re-criar o setData entre renders.
  const setData = useCallback(
    (updater: T | null | ((prev: T | null) => T | null)) => {
      setDataState((prev) =>
        typeof updater === "function" ? (updater as (p: T | null) => T | null)(prev) : updater,
      );
    },
    [],
  );

  const lastIdRef = useRef<string | null | undefined>(id);

  useEffect(() => {
    if (!id) {
      setDataState(null);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);
    // Reset entre ids — evita ver dados do registro anterior por um frame.
    if (lastIdRef.current !== id) {
      setDataState(null);
      lastIdRef.current = id;
    }

    loader(id, controller.signal)
      .then((result) => {
        if (cancelled || controller.signal.aborted) return;
        setDataState(result);
      })
      .catch((err) => {
        if (cancelled || controller.signal.aborted) return;
        // AbortError não deve reportar erro — é cancelamento intencional.
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === "AbortError") return;
        setError(e);
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
  }, [id, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { data, loading, error, reload, setData };
}
