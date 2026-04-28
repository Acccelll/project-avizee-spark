/**
 * OfflineBanner — barra fina sticky no topo quando o navegador perde rede.
 *
 * Reaproveita `useOnlineStatus` (listeners de window). Não interfere com
 * outros banners (auth, cookies) — fica acima de tudo com z-index alto e
 * compensa o `safe-area-inset-top` para iOS PWA.
 */

import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-[100] bg-amber-500/95 text-amber-950 text-xs font-medium py-1.5 px-3 flex items-center justify-center gap-2 shadow-sm pt-[max(0.375rem,env(safe-area-inset-top))]"
    >
      <WifiOff className="h-3.5 w-3.5" />
      <span>Você está offline. Algumas ações ficam indisponíveis até a conexão voltar.</span>
    </div>
  );
}