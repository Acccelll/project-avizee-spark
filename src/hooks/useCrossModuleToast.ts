import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useRelationalNavigation, type EntityType } from "@/contexts/RelationalNavigationContext";

interface CrossModuleToastOptions {
  /** Título principal do toast (obrigatório). */
  title: string;
  /** Descrição em segunda linha. */
  description?: string;
  /** Label do botão de ação (CTA). Ex.: "Abrir pedido". */
  actionLabel?: string;
  /**
   * Como abrir o destino:
   * - `{ drawer: { type, id } }` → `pushView` (mantém contexto, abre drawer lateral).
   * - `{ route: "/path" }` → navega para outra rota.
   * - `{ onClick: () => void }` → callback customizado.
   */
  action?:
    | { drawer: { type: EntityType; id: string } }
    | { route: string }
    | { onClick: () => void };
  /** Duração em ms. Padrão: 6000 quando há ação, 4000 sem ação. */
  duration?: number;
}

/**
 * Helper para padronizar toasts pós-ação cross-módulo com CTA contextual.
 *
 * Resolve "toast burro" — após gerar NF / converter cotação / receber compra,
 * o usuário não fica perdido. Vê o que aconteceu E pode abrir o destino com
 * 1 clique (drawer ou nova rota).
 *
 * @example
 * const crossToast = useCrossModuleToast();
 * crossToast.success({
 *   title: "Pedido gerado!",
 *   description: `OV ${numero} criada em /pedidos`,
 *   actionLabel: "Abrir pedido",
 *   action: { drawer: { type: "ordem_venda", id: ovId } },
 * });
 */
export function useCrossModuleToast() {
  const navigate = useNavigate();
  const { pushView } = useRelationalNavigation();

  const fire = useCallback(
    (kind: "success" | "info", opts: CrossModuleToastOptions) => {
      const { title, description, actionLabel, action, duration } = opts;
      const toastFn = kind === "success" ? toast.success : toast.info;

      const actionConfig =
        action && actionLabel
          ? {
              label: actionLabel,
              onClick: () => {
                if ("drawer" in action) {
                  pushView(action.drawer.type, action.drawer.id);
                } else if ("route" in action) {
                  navigate(action.route);
                } else if ("onClick" in action) {
                  action.onClick();
                }
              },
            }
          : undefined;

      toastFn(title, {
        description,
        action: actionConfig,
        duration: duration ?? (action ? 6000 : 4000),
      });
    },
    [navigate, pushView],
  );

  return {
    success: (opts: CrossModuleToastOptions) => fire("success", opts),
    info: (opts: CrossModuleToastOptions) => fire("info", opts),
  };
}
