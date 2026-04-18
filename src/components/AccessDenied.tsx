import { ReactNode, useState } from "react";
import { ShieldOff } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DetailEmpty } from "@/components/ui/DetailStates";
import { RequestAccessDialog } from "@/components/RequestAccessDialog";

export type AccessDeniedVariant = "route" | "action" | "feature";

export interface AccessDeniedProps {
  title?: string;
  message?: string;
  /** Ação customizada — quando passada, substitui o bloco padrão de CTAs. */
  action?: ReactNode;
  /** Quando true, renderiza ocupando viewport completo (uso em route guards). */
  fullPage?: boolean;
  /** Mostra botão "Voltar ao início" apontando para `/`. Default: true. */
  showBackButton?: boolean;
  /** Variante visual: route (default), action (inline), feature (placeholder). */
  variant?: AccessDeniedVariant;
  /** Rótulo humanizado do recurso para exibir na CTA "Solicitar acesso". */
  resourceLabel?: string;
  /** Permissão exigida (apenas para contexto no e-mail de solicitação). */
  permissionKey?: string;
  /** Quando true, exibe botão "Solicitar acesso" (default: true em variant=route). */
  showRequestAccess?: boolean;
}

/**
 * Componente único para feedback de acesso negado.
 *
 * Variantes:
 *  - `route`: full page, ícone grande, CTAs "Voltar" + "Solicitar acesso".
 *  - `action`: inline compacto para painéis e seções.
 *  - `feature`: placeholder para áreas dentro de uma página acessível.
 */
export function AccessDenied({
  title = "Acesso restrito",
  message,
  action,
  fullPage = false,
  showBackButton = true,
  variant = "route",
  resourceLabel,
  permissionKey,
  showRequestAccess,
}: AccessDeniedProps) {
  const [requestOpen, setRequestOpen] = useState(false);

  const finalMessage =
    message ??
    (resourceLabel
      ? `Você não tem permissão para acessar ${resourceLabel}. Solicite acesso ao administrador.`
      : "Você não tem permissão para visualizar este conteúdo. Solicite acesso ao administrador.");

  const showRequest = showRequestAccess ?? variant === "route";

  const finalAction =
    action ??
    (
      <div className="flex flex-col sm:flex-row gap-2 items-center justify-center">
        {showRequest && (
          <Button onClick={() => setRequestOpen(true)} size="sm">
            Solicitar acesso
          </Button>
        )}
        {showBackButton && (
          <Button asChild variant="outline" size="sm">
            <Link to="/">Voltar ao início</Link>
          </Button>
        )}
      </div>
    );

  // Variante action — inline pequeno, sem CTA
  if (variant === "action") {
    return (
      <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldOff className="h-3.5 w-3.5 text-warning" />
        <span>{finalMessage}</span>
      </div>
    );
  }

  // Variante feature — card cinza placeholder de seção
  if (variant === "feature") {
    return (
      <>
        <div className="rounded-lg border border-dashed bg-muted/20 px-6 py-8 text-center">
          <ShieldOff className="h-8 w-8 text-warning mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">{finalMessage}</p>
          {showRequest && (
            <Button size="sm" variant="outline" className="mt-4" onClick={() => setRequestOpen(true)}>
              Solicitar acesso
            </Button>
          )}
        </div>
        <RequestAccessDialog
          open={requestOpen}
          onOpenChange={setRequestOpen}
          resourceLabel={resourceLabel}
          permissionKey={permissionKey}
        />
      </>
    );
  }

  // Variante route (default) — usa DetailEmpty + CTAs
  const content = (
    <DetailEmpty
      icon={ShieldOff}
      title={title}
      message={finalMessage}
      action={finalAction}
      variant="warning"
    />
  );

  const wrapper = fullPage ? (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">{content}</div>
    </div>
  ) : (
    content
  );

  return (
    <>
      {wrapper}
      <RequestAccessDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        resourceLabel={resourceLabel}
        permissionKey={permissionKey}
      />
    </>
  );
}
