/**
 * `PermissionGate` — wrapper para ações com permissão.
 *
 * Modos:
 *  - `hide` (default): renderiza `null` quando o usuário não tem permissão
 *    (mantém comportamento atual; usar para ações administrativas raras).
 *  - `disable`: renderiza o filho **desabilitado** + tooltip explicando o
 *    motivo. Usar para ações primárias visíveis (Editar, Excluir, Aprovar)
 *    para diferenciar **proibido** (sem permissão) de **indisponível**
 *    (estado do registro impede a ação).
 *
 * O modo `disable` exige que o filho seja um único elemento React capaz de
 * receber `disabled`/`aria-disabled` (Button, IconButton). Para outros nós,
 * usar `mode="hide"`.
 *
 * @example
 * <PermissionGate resource="pedidos" action="excluir" mode="disable">
 *   <Button variant="destructive">Excluir</Button>
 * </PermissionGate>
 */

import { cloneElement, isValidElement, ReactElement, ReactNode } from "react";
import { Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCan } from "@/hooks/useCan";
import { humanizeAction, humanizeResource, type ErpAction, type ErpResource } from "@/lib/permissions";

export interface PermissionGateProps {
  resource: ErpResource;
  action?: ErpAction;
  mode?: "hide" | "disable";
  /** Mensagem custom no tooltip (mode=disable). */
  tooltip?: string;
  children: ReactNode;
}

export function PermissionGate({
  resource,
  action = "visualizar",
  mode = "hide",
  tooltip,
  children,
}: PermissionGateProps) {
  const { can } = useCan();
  const allowed = can(`${resource}:${action}`);

  if (allowed) return <>{children}</>;

  if (mode === "hide") return null;

  // mode === "disable" — clona o filho com `disabled` e envolve em tooltip
  const message =
    tooltip ??
    `Você não tem permissão para ${humanizeAction(action).toLowerCase()} em ${humanizeResource(resource)}. Solicite acesso ao administrador.`;

  let disabledChild: ReactNode = children;
  if (isValidElement(children)) {
    const props = children.props as Record<string, unknown>;
    disabledChild = cloneElement(children as ReactElement<Record<string, unknown>>, {
      disabled: true,
      "aria-disabled": true,
      // Evita acionar handlers do filho no estado bloqueado
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
      },
      // Preserva tabindex/aria do filho original quando possível
      tabIndex: typeof props.tabIndex === "number" ? props.tabIndex : -1,
    });
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Span garante que tooltip funcione mesmo com children disabled (pointer-events:none nos buttons disabled) */}
        <span className="inline-flex cursor-not-allowed">{disabledChild}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="flex items-start gap-2">
          <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span className="text-xs leading-snug">{message}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
