/**
 * InstallPwaButton — captura o evento `beforeinstallprompt` (Chrome/Edge,
 * Android) e exibe um botão discreto que dispara o prompt nativo de
 * instalação. Em iOS Safari (sem suporte ao evento) o botão não aparece —
 * a instalação manual via "Adicionar à tela inicial" é guiada por outra UI.
 */

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "avizee.pwa.install.dismissed";

export function InstallPwaButton({ className }: { className?: string }) {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    function onBefore(e: Event) {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setEvt(null);
      try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* no-op */ }
    }
    window.addEventListener("beforeinstallprompt", onBefore);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBefore);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!evt || dismissed) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={async () => {
        await evt.prompt();
        const choice = await evt.userChoice;
        if (choice.outcome !== "accepted") {
          try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* no-op */ }
          setDismissed(true);
        }
        setEvt(null);
      }}
      title="Instalar o app na tela inicial"
    >
      <Download className="h-3.5 w-3.5" />
      <span className="ml-1.5">Instalar app</span>
    </Button>
  );
}