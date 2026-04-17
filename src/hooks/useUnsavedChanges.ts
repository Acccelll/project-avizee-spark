import { useEffect, useCallback } from "react";
import { useBlocker } from "react-router-dom";

/**
 * Detects unsaved form changes and:
 * 1. Blocks in-app navigation via React Router's `useBlocker` — shows the
 *    browser's native confirm dialog so the user can stay or leave.
 * 2. Prevents the browser's native "close tab / reload" event using
 *    `beforeunload`.
 *
 * @param isDirty  Pass `formState.isDirty` (react-hook-form) or any boolean
 *                 that is `true` whenever there are unsaved changes.
 * @param message  Optional custom message shown in the confirm prompt.
 *
 * @example
 * ```tsx
 * const { formState: { isDirty } } = useForm();
 * useUnsavedChanges(isDirty);
 * ```
 */
export function useUnsavedChanges(
  isDirty: boolean,
  message = "Você tem alterações não salvas. Deseja sair mesmo assim?",
) {
  // Block in-app navigation when dirty
  useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) =>
        isDirty && currentLocation.pathname !== nextLocation.pathname,
      [isDirty],
    ),
  );

  // Block browser close / reload / external navigation
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore the returnValue string but it's required for
      // older ones to show the dialog.
      e.returnValue = message;
      return message;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, message]);
}
