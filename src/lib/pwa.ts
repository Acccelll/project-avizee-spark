/**
 * PWA bootstrap — registro manual do service worker via workbox-window.
 *
 * Por que manual: usamos `registerType: "prompt"` no vite-plugin-pwa e
 * `injectRegister: false`. Assim controlamos:
 *   1. Quando o SW é registrado (apenas em produção, fora de iframes do
 *      preview do Lovable, e quando suportado).
 *   2. Quando o usuário é avisado de que há nova versão disponível (toast).
 *
 * O hook `useUpdateAvailable` consome o evento global `pwa:update-ready`
 * disparado aqui para mostrar um toast com botão "Atualizar".
 */

import type { Workbox } from "workbox-window";

let wb: Workbox | undefined;

const PWA_UPDATE_EVENT = "pwa:update-ready";

function dispatchUpdateReady() {
  window.dispatchEvent(new CustomEvent(PWA_UPDATE_EVENT));
}

export async function registerPwa(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  // Não registra em DEV (devOptions.enabled = false no plugin) nem em iframes
  // do preview Lovable — o SW pode interferir no overlay de tagger/HMR.
  if (import.meta.env.DEV) return;
  if (window.self !== window.top) return;

  try {
    const { Workbox } = await import("workbox-window");
    wb = new Workbox("/sw.js", { scope: "/" });

    wb.addEventListener("waiting", dispatchUpdateReady);
    wb.addEventListener("externalwaiting", dispatchUpdateReady);

    await wb.register();
  } catch (e) {
    // Falha de registro é não-fatal — o app segue funcionando online normal.
    console.warn("[pwa] falha ao registrar service worker", e);
  }
}

/** Aplica a nova versão e recarrega a página. */
export function applyPwaUpdate(): void {
  if (!wb) {
    window.location.reload();
    return;
  }
  wb.addEventListener("controlling", () => window.location.reload());
  wb.messageSkipWaiting();
}

export const PWA_EVENTS = { UPDATE_READY: PWA_UPDATE_EVENT } as const;