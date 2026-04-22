import { useEffect } from "react";

/**
 * Bloqueia o fechamento/refresh da aba enquanto `enabled === true`.
 *
 * Use em forms de edição quando há mudanças não salvas (`isDirty`).
 * O navegador exibe o seu próprio prompt nativo — a `message` é
 * informativa apenas (browsers modernos ignoram a string customizada).
 *
 * Não substitui o `confirm` do botão Voltar interno (esse é controlado
 * via `useConfirmDialog`); cobre apenas navegação **fora** do React Router
 * (fechar aba, recarregar, navegar para outra origem).
 */
export function useBeforeUnloadGuard(enabled: boolean, message = "Há alterações não salvas."): void {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Required for legacy browsers; modern browsers display their own message.
      e.returnValue = message;
      return message;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [enabled, message]);
}