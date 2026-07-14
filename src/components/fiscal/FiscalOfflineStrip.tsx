import { WifiOff } from "lucide-react";
import { useFiscalConnectivity } from "@/hooks/useFiscalConnectivity";

/**
 * Etapa 15 — Strip discreto exibido no shell fiscal quando o runtime perde
 * conectividade. Não interrompe a UI; apenas comunica o estado para que
 * ações que dependem de SEFAZ/Cloud possam ser retomadas ao reconectar.
 */
export function FiscalOfflineStrip() {
  const { online } = useFiscalConnectivity();
  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive"
    >
      <WifiOff className="h-3.5 w-3.5" />
      <span>
        Sem conexão — operações fiscais (SEFAZ/Cloud) serão retomadas assim que a rede voltar.
      </span>
    </div>
  );
}

export default FiscalOfflineStrip;