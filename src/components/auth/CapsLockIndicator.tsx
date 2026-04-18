/**
 * `CapsLockIndicator` — exibe aviso discreto quando a tecla Caps Lock está
 * ativa no campo de senha. Causa real de "senha incorreta" não percebida.
 */

import { useEffect, useState } from "react";
import { ArrowBigUp } from "lucide-react";

export function CapsLockIndicator() {
  const [capsOn, setCapsOn] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const state = e.getModifierState && e.getModifierState("CapsLock");
      setCapsOn(Boolean(state));
    };
    window.addEventListener("keydown", handler);
    window.addEventListener("keyup", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("keyup", handler);
    };
  }, []);

  if (!capsOn) return null;

  return (
    <p
      role="status"
      aria-live="polite"
      className="flex items-center gap-1.5 text-xs text-warning mt-1.5"
    >
      <ArrowBigUp className="h-3.5 w-3.5" />
      Caps Lock está ativo
    </p>
  );
}
