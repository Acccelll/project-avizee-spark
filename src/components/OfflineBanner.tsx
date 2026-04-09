import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="w-full bg-amber-500/90 text-amber-950 px-4 py-2 text-sm flex items-center gap-2 justify-center">
      <WifiOff className="h-4 w-4" />
      Você está offline. Alterações serão salvas localmente e sincronizadas quando a conexão for restaurada.
    </div>
  );
}
