import { ShieldOff } from "lucide-react";
import { ReactNode } from "react";
import { DetailEmpty } from "@/components/ui/DetailStates";

export interface AccessDeniedProps {
  title?: string;
  message?: string;
  action?: ReactNode;
  /** Quando true, renderiza ocupando viewport completo (uso em route guards). */
  fullPage?: boolean;
}

/**
 * Componente único para feedback de acesso negado. Substitui:
 *  - `Navigate to "/"` silencioso de AdminRoute/SocialRoute;
 *  - blocos ad-hoc de "Você não possui permissão" em páginas.
 *
 * Mantém consistência visual com DetailEmpty.
 */
export function AccessDenied({
  title = "Acesso restrito",
  message = "Você não tem permissão para visualizar este conteúdo. Solicite acesso ao administrador.",
  action,
  fullPage = false,
}: AccessDeniedProps) {
  const content = (
    <DetailEmpty icon={ShieldOff} title={title} message={message} action={action} />
  );

  if (fullPage) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md">{content}</div>
      </div>
    );
  }

  return content;
}
