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

/**
 * Variantes:
 * - `inline`: botão padrão, para incluir em headers/configurações.
 * - `floating` (default): card flutuante no canto inferior direito,
 *   monta-se sozinho quando o navegador oferece o prompt.
 */
export function InstallPwaButton({ className, variant = "floating" }: { className?: string; variant?: "inline" | "floating" }) {
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

  const handleInstall = async () => {
    if (!evt) return;
    await evt.prompt();
    const choice = await evt.userChoice;
    if (choice.outcome !== "accepted") {
      try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* no-op */ }
      setDismissed(true);
    }
    setEvt(null);
  };

  const handleDismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* no-op */ }
    setDismissed(true);
  };

  if (variant === "inline") {
    return (
      <Button
        variant="outline"
        size="sm"
        className={className}
        onClick={handleInstall}
        title="Instalar o app na tela inicial"
      >
        <Download className="h-3.5 w-3.5" />
        <span className="ml-1.5">Instalar app</span>
      </Button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Instalar aplicativo AviZee"
      className="fixed bottom-4 right-4 z-[90] max-w-xs rounded-lg border bg-background shadow-lg p-3 flex items-start gap-3 animate-in slide-in-from-bottom-2"
    >
      <Download className="h-5 w-5 mt-0.5 text-primary shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Instalar AviZee</p>
        <p className="text-xs text-muted-foreground mt-0.5">Acesse offline e abra mais rápido na tela inicial.</p>
        <div className="flex gap-2 mt-2">
          <Button size="sm" className="h-7 text-xs" onClick={handleInstall}>Instalar</Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleDismiss}>Agora não</Button>
        </div>
      </div>
    </div>
  );
}