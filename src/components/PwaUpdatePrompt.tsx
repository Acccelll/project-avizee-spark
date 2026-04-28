/**
 * PwaUpdatePrompt — toast persistente quando uma nova versão do app está
 * disponível. Escuta o evento global `pwa:update-ready` disparado por
 * `src/lib/pwa.ts` e oferece o botão "Atualizar" que aplica a nova SW
 * e recarrega a página.
 */

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { applyPwaUpdate, PWA_EVENTS } from "@/lib/pwa";

export function PwaUpdatePrompt() {
  const shown = useRef(false);

  useEffect(() => {
    function onReady() {
      if (shown.current) return;
      shown.current = true;
      toast("Nova versão disponível", {
        description: "Recarregue para aplicar as últimas atualizações.",
        duration: Infinity,
        action: {
          label: "Atualizar",
          onClick: () => applyPwaUpdate(),
        },
      });
    }
    window.addEventListener(PWA_EVENTS.UPDATE_READY, onReady);
    return () => window.removeEventListener(PWA_EVENTS.UPDATE_READY, onReady);
  }, []);

  return null;
}