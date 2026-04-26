import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConfirmDestructiveDialog,
  type ConfirmDestructiveDialogProps,
  type DestructiveVerb,
} from "@/components/ConfirmDestructiveDialog";

type Options = Omit<
  ConfirmDestructiveDialogProps,
  "open" | "onClose" | "onConfirm" | "loading"
>;

/**
 * Hook utilitário para `ConfirmDestructiveDialog`. Análogo ao `useConfirmDialog`,
 * porém o callback recebe o `motivo` digitado pelo usuário.
 *
 * Uso:
 *   const { confirm, dialog } = useConfirmDestructive();
 *   ...
 *   await confirm(
 *     {
 *       verb: "Cancelar",
 *       entity: `pedido #${pedido.numero}`,
 *       sideEffects: ["Estorno de estoque dos itens", "NF associada será cancelada na SEFAZ"],
 *     },
 *     async (motivo) => {
 *       await pedidosService.cancelar(pedido.id, motivo);
 *     },
 *   );
 *
 * O dialog permanece aberto durante a action async; fecha em sucesso, mantém aberto
 * em erro (caller já tratou via toast).
 */
export function useConfirmDestructive(defaults: Options = { verb: "Cancelar" }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<Options>(defaults);
  const [loading, setLoading] = useState(false);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const actionRef = useRef<((motivo: string) => Promise<void> | void) | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (resolverRef.current) {
        resolverRef.current(false);
        resolverRef.current = null;
      }
    };
  }, []);

  const confirm = useCallback(
    (
      override?: Partial<Options> & { verb?: DestructiveVerb },
      asyncAction?: (motivo: string) => Promise<void> | void,
    ) => {
      setOpts({ ...defaults, ...(override ?? {}) });
      actionRef.current = asyncAction ?? null;
      setLoading(false);
      setOpen(true);
      return new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
      });
    },
    [defaults],
  );

  const handleConfirm = useCallback(async (motivo: string) => {
    const action = actionRef.current;
    if (action) {
      setLoading(true);
      try {
        await action(motivo);
        if (!mountedRef.current) return;
        resolverRef.current?.(true);
        resolverRef.current = null;
        actionRef.current = null;
        setOpen(false);
      } catch (err) {
        if (mountedRef.current) setLoading(false);
        throw err;
      } finally {
        if (mountedRef.current && !actionRef.current) setLoading(false);
      }
      return;
    }
    resolverRef.current?.(true);
    resolverRef.current = null;
    setOpen(false);
  }, []);

  const handleClose = useCallback(() => {
    if (loading) return;
    resolverRef.current?.(false);
    resolverRef.current = null;
    actionRef.current = null;
    setOpen(false);
  }, [loading]);

  const dialog = (
    <ConfirmDestructiveDialog
      {...opts}
      open={open}
      onClose={handleClose}
      onConfirm={handleConfirm}
      loading={loading}
    />
  );

  return { confirm, dialog };
}