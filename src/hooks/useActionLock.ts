import { useCallback, useRef, useState } from "react";

/**
 * useActionLock — previne duplo clique em ações destrutivas/transacionais
 * cujo handler vem como prop (e portanto não é controlado por `useSubmitLock`).
 *
 * Estratégia:
 *  - `run(fn)` bloqueia novas chamadas enquanto a anterior estiver pendente.
 *  - O lock só libera quando a Promise resolve OU após um `cooldownMs` mínimo
 *    (default 500ms) — protege contra handlers síncronos ou que disparam
 *    refetch global e o usuário clicar antes do estado refletir.
 *
 * O componente passa `pending` ao `disabled` do botão e `run(handler)` ao onClick.
 */
export function useActionLock(cooldownMs: number = 500) {
  const [pending, setPending] = useState(false);
  const lockRef = useRef(false);

  const run = useCallback(
    async <R,>(fn: () => R | Promise<R>): Promise<R | undefined> => {
      if (lockRef.current) return undefined;
      lockRef.current = true;
      setPending(true);
      const startedAt = Date.now();
      try {
        return await Promise.resolve(fn());
      } finally {
        const elapsed = Date.now() - startedAt;
        const wait = Math.max(0, cooldownMs - elapsed);
        if (wait > 0) {
          setTimeout(() => {
            lockRef.current = false;
            setPending(false);
          }, wait);
        } else {
          lockRef.current = false;
          setPending(false);
        }
      }
    },
    [cooldownMs],
  );

  return { pending, run };
}
