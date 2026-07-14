import { useEffect, useState } from "react";

/**
 * Etapa 15 — Detecta o estado de conectividade do runtime fiscal.
 *
 * Escuta `online`/`offline` do navegador e expõe uma flag + timestamp da
 * última mudança. Serve como base para o strip de recuperação de conexão
 * do shell fiscal (nenhum side-effect fiscal aqui — apenas UI).
 */
export function useFiscalConnectivity() {
  const [online, setOnline] = useState<boolean>(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [changedAt, setChangedAt] = useState<string | null>(null);

  useEffect(() => {
    const handle = (next: boolean) => () => {
      setOnline(next);
      setChangedAt(new Date().toISOString());
    };
    const on = handle(true);
    const off = handle(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return { online, changedAt };
}