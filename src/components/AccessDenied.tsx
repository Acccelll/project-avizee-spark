import { ShieldOff } from "lucide-react";
import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DetailEmpty } from "@/components/ui/DetailStates";

export interface AccessDeniedProps {
  title?: string;
  message?: string;
  /** Ação customizada — quando passada, substitui o botão padrão "Voltar ao início". */
  action?: ReactNode;
  /** Quando true, renderiza ocupando viewport completo (uso em route guards). */
  fullPage?: boolean;
  /** Mostra botão "Voltar ao início" apontando para `/`. Default: true. */
  showBackButton?: boolean;
}

/**
 * Componente único para feedback de acesso negado. Substitui:
 *  - `Navigate to "/"` silencioso de AdminRoute/SocialRoute;
 *  - blocos ad-hoc de "Você não possui permissão" em páginas.
 *
 * Usa variant `warning` (círculo `bg-warning/10`) para diferenciar visualmente
 * de erros (vermelho) e estados vazios (cinza/azul).
 *
 * @example
 * // Em rota protegida
 * <AccessDenied fullPage title="Área administrativa" />
 *
 * @example
 * // Inline com ação custom
 * <AccessDenied
 *   message="Apenas vendedores podem gerar pedidos."
 *   action={<Button onClick={requestAccess}>Solicitar acesso</Button>}
 * />
 */
export function AccessDenied({
  title = "Acesso restrito",
  message = "Você não tem permissão para visualizar este conteúdo. Solicite acesso ao administrador.",
  action,
  fullPage = false,
  showBackButton = true,
}: AccessDeniedProps) {
  const finalAction =
    action ??
    (showBackButton ? (
      <Button asChild variant="outline" size="sm">
        <Link to="/">Voltar ao início</Link>
      </Button>
    ) : undefined);

  const content = (
    <DetailEmpty
      icon={ShieldOff}
      title={title}
      message={message}
      action={finalAction}
      variant="warning"
    />
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
