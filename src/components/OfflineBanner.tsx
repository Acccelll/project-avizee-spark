import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full bg-warning/15 text-warning border-b border-warning/30 px-4 py-2 text-sm flex items-center gap-2 justify-center"
    >
      <WifiOff className="h-4 w-4" />
      <span className="text-foreground/90">
        Você está offline. Alterações serão salvas localmente e sincronizadas quando a conexão for restaurada.
      </span>
    </div>
  );
}
