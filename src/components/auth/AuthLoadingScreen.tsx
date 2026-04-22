/**
 * `AuthLoadingScreen` — splash com branding usado pelos guards de rota
 * (Protected/Admin/Permission/Social) durante a checagem inicial de
 * sessão e permissões.
 *
 * Substitui o `FullPageSpinner` "morto" — usuário vê logo + label
 * adaptativa em vez de um spinner cinza isolado.
 */

import { Spinner } from "@/components/ui/spinner";
import { useBranding } from "@/hooks/useBranding";

export type AuthLoadingMode = "session" | "permissions" | "restoring";

const LABELS: Record<AuthLoadingMode, string> = {
  session: "Carregando sessão",
  permissions: "Verificando permissões",
  restoring: "Restaurando acesso",
};

export interface AuthLoadingScreenProps {
  mode?: AuthLoadingMode;
  /** Override completo da mensagem (sobrescreve `mode`). */
  label?: string;
}

export function AuthLoadingScreen({ mode = "session", label }: AuthLoadingScreenProps) {
  const finalLabel = label ?? LABELS[mode];
  const branding = useBranding();
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-6 animate-fade-in">
      <div className="flex flex-col items-center gap-6">
        <img
          src={branding.logoUrl}
          alt={branding.marcaTexto || "ERP"}
          className="h-14 drop-shadow-sm opacity-95"
        />
        <div className="flex flex-col items-center gap-3">
          <Spinner size="md" label={finalLabel} />
          <p className="text-sm text-muted-foreground" aria-hidden="true">
            {finalLabel}…
          </p>
        </div>
      </div>
    </div>
  );
}
