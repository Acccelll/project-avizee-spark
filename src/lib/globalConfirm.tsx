import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export interface GlobalConfirmOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  confirmVariant?: "destructive" | "default";
}

type Listener = (state: State | null) => void;

interface State {
  opts: GlobalConfirmOptions;
  resolve: (ok: boolean) => void;
}

let current: State | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l(current));
}

/**
 * Confirmação assíncrona, estilizada e interna ao sistema.
 * Substitui `window.confirm` (que abre um pop-up nativo do navegador).
 * Requer que `<GlobalConfirmHost />` esteja montado uma única vez em App.
 */
export function confirmAsync(opts: GlobalConfirmOptions = {}): Promise<boolean> {
  // Se já existe um diálogo aberto, resolve o anterior como cancelado.
  if (current) current.resolve(false);
  return new Promise<boolean>((resolve) => {
    current = { opts, resolve };
    emit();
  });
}

export function GlobalConfirmHost() {
  const [state, setState] = useState<State | null>(current);

  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  const close = (ok: boolean) => {
    if (!current) return;
    const s = current;
    current = null;
    emit();
    s.resolve(ok);
  };

  return (
    <ConfirmDialog
      open={!!state}
      onClose={() => close(false)}
      onConfirm={() => close(true)}
      title={state?.opts.title}
      description={state?.opts.description}
      confirmLabel={state?.opts.confirmLabel}
      confirmVariant={state?.opts.confirmVariant ?? "destructive"}
    />
  );
}