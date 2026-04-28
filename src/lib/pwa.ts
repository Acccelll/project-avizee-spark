/**
 * PWA bootstrap — registro manual do service worker via workbox-window.
 *
 * Estratégia: `registerType: "autoUpdate"` no vite-plugin-pwa garante que
 * SWs novos assumam automaticamente (skipWaiting + clientsClaim no workbox).
 * Mantemos o evento `pwa:update-ready` por compatibilidade com o toast em
 * `useUpdateAvailable`, mas ele é apenas informativo — a atualização já
 * aconteceu silenciosamente. Isto resolve o caso "PWA instalado no mobile
 * preso a um bundle JS antigo com envs vazias", em que o usuário nunca via
 * o prompt para atualizar e ficava bloqueado no /login.
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
    // `externalwaiting` (SW novo detectado em outra aba) — nem todas as
    // versões de workbox-window declaram o tipo. Cast para evitar TS2345.
    (wb.addEventListener as unknown as (e: string, l: () => void) => void)(
      "externalwaiting",
      dispatchUpdateReady,
    );

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