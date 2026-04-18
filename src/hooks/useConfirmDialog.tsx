import { useCallback, useEffect, useRef, useState } from "react";
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
 * Hook utilitário que renderiza um ConfirmDialog controlado.
 *
 * Duas formas de uso:
 *
 * 1) Boolean simples (descarte de dirty, fluxos síncronos):
 *      const ok = await confirm();
 *      if (!ok) return;
 *      doStuff();
 *
 * 2) Com ação assíncrona (mantém o dialog aberto com spinner enquanto roda;
 *    fecha em sucesso, mantém aberto em erro para o caller exibir feedback):
 *      await confirm({ title: "Excluir?" }, async () => {
 *        await api.delete(id);
 *      });
 *
 *  Diferenças vs `window.confirm`:
 *   - estilizado e acessível;
 *   - não bloqueia o event loop;
 *   - suporta loading state;
 *   - cleanup no unmount evita Promise pendurada.
 */
export function useConfirmDialog(defaults: ConfirmOptions = DEFAULT_DISCARD) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions>(defaults);
  const [loading, setLoading] = useState(false);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const actionRef = useRef<(() => Promise<void> | void) | null>(null);
  const mountedRef = useRef(true);

  // Cleanup: se o componente desmontar com dialog aberto, libera Promise pendurada.
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
    (override?: ConfirmOptions, asyncAction?: () => Promise<void> | void) => {
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

  const handleConfirm = useCallback(async () => {
    const action = actionRef.current;
    if (action) {
      // Fluxo async: mantém dialog aberto + loading; fecha apenas em sucesso.
      setLoading(true);
      try {
        await action();
        if (!mountedRef.current) return;
        resolverRef.current?.(true);
        resolverRef.current = null;
        actionRef.current = null;
        setOpen(false);
      } catch (err) {
        // Erro: mantém dialog aberto, libera loading. Caller já tratou via toast.
        if (mountedRef.current) setLoading(false);
        throw err;
      } finally {
        if (mountedRef.current && !actionRef.current) setLoading(false);
      }
      return;
    }
    // Fluxo simples: resolve true e fecha.
    resolverRef.current?.(true);
    resolverRef.current = null;
    setOpen(false);
  }, []);

  const handleClose = useCallback(() => {
    if (loading) return; // bloqueado durante async
    resolverRef.current?.(false);
    resolverRef.current = null;
    actionRef.current = null;
    setOpen(false);
  }, [loading]);

  const dialog = (
    <ConfirmDialog
      open={open}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={opts.title}
      description={opts.description}
      confirmLabel={opts.confirmLabel}
      confirmVariant={opts.confirmVariant}
      loading={loading}
    />
  );

  return { confirm, dialog };
}
