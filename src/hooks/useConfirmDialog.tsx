import { useCallback, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  confirmVariant?: "destructive" | "default";
}

const DEFAULT_DISCARD: ConfirmOptions = {
  title: "Alterações não salvas",
  description: "Existem alterações não salvas. Deseja descartar e fechar?",
  confirmLabel: "Descartar",
  confirmVariant: "destructive",
};

/**
 * Hook utilitário que renderiza um ConfirmDialog controlado e retorna
 * uma função `confirm(opts?)` que resolve uma Promise<boolean>.
 *
 * Substitui chamadas a `window.confirm(...)` mantendo o mesmo padrão de uso:
 *   const ok = await confirm();
 *   if (!ok) return;
 */
export function useConfirmDialog(defaults: ConfirmOptions = DEFAULT_DISCARD) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions>(defaults);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback(
    (override?: ConfirmOptions) => {
      setOpts({ ...defaults, ...(override ?? {}) });
      setOpen(true);
      return new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
      });
    },
    [defaults],
  );

  const handleConfirm = useCallback(() => {
    resolverRef.current?.(true);
    resolverRef.current = null;
    setOpen(false);
  }, []);

  const handleClose = useCallback(() => {
    resolverRef.current?.(false);
    resolverRef.current = null;
    setOpen(false);
  }, []);

  const dialog = (
    <ConfirmDialog
      open={open}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={opts.title}
      description={opts.description}
      confirmLabel={opts.confirmLabel}
      confirmVariant={opts.confirmVariant}
    />
  );

  return { confirm, dialog };
}
