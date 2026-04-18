import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/errorMessages";

/**
 * useDetailActions — lock POR AÇÃO (não global) para botões das Views de
 * detalhe (Aprovar, Gerar NF, Excluir, Converter…).
 *
 * O padrão antigo usava um único `actionLoading` compartilhado: clicar em
 * "Aprovar" desabilitava também "Excluir" e "Editar". Aqui cada chave tem
 * seu próprio estado pendente, então só o botão acionado fica em loading.
 *
 * Uso:
 * ```tsx
 * const { run, locked, isAnyLocked } = useDetailActions();
 *
 * <Button disabled={locked("approve")} onClick={() => run("approve", async () => {
 *   await approveOrcamento(selected);
 *   await reload();
 * })} />
 * ```
 *
 * Erros viram toast automaticamente (configurável). Re-lança para o caller
 * decidir se quer fechar dialog/limpar form etc.
 */
export interface UseDetailActionsOptions {
  /** Mostra toast.error ao falhar. Default: true. */
  toastOnError?: boolean;
}

export interface UseDetailActionsApi {
  /** Executa `fn` sob lock identificado por `key`. Concorrências são ignoradas. */
  run: <R>(key: string, fn: () => Promise<R>) => Promise<R | null>;
  /** True se a ação `key` está pendente. */
  locked: (key: string) => boolean;
  /** True se QUALQUER ação está pendente (útil para desabilitar formulário inteiro). */
  isAnyLocked: boolean;
}

export function useDetailActions(opts: UseDetailActionsOptions = {}): UseDetailActionsApi {
  const { toastOnError = true } = opts;
  const [pending, setPending] = useState<Record<string, boolean>>({});
  // Ref síncrono para evitar duplo-disparo entre o clique e o re-render.
  const lockRef = useRef<Set<string>>(new Set());

  const run = useCallback(
    async <R,>(key: string, fn: () => Promise<R>): Promise<R | null> => {
      if (lockRef.current.has(key)) return null;
      lockRef.current.add(key);
      setPending((prev) => ({ ...prev, [key]: true }));
      try {
        return await fn();
      } catch (err) {
        if (toastOnError) toast.error(getUserFriendlyError(err));
        throw err;
      } finally {
        lockRef.current.delete(key);
        setPending((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    },
    [toastOnError],
  );

  const locked = useCallback((key: string) => Boolean(pending[key]), [pending]);
  const isAnyLocked = Object.keys(pending).length > 0;

  return { run, locked, isAnyLocked };
}
