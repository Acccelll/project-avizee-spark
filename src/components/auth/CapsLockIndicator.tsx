/**
 * `CapsLockIndicator` — exibe aviso discreto quando a tecla Caps Lock está
 * ativa no campo de senha. Causa real de "senha incorreta" não percebida.
 */

import { useEffect, useState } from "react";
import { ArrowBigUp } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export function CapsLockIndicator() {
  const isMobile = useIsMobile();
  const [capsOn, setCapsOn] = useState(false);

  useEffect(() => {
    // Teclados virtuais (iOS/Android) não expõem CapsLock — listener inútil no mobile.
    if (isMobile) return;
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
  }, [isMobile]);

  if (isMobile || !capsOn) return null;

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
