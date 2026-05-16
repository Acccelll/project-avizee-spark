/**
 * AdminDirtyContext — compartilha o estado de "alterações não salvas" entre a
 * seção ativa e o orquestrador `Administracao.tsx`, permitindo interceptar
 * navegação entre seções com um ConfirmDialog.
 *
 * Padrão de uso:
 *   - `<AdminDirtyProvider>` envolve a página de Administração.
 *   - Seções editáveis chamam `useReportDirty(isDirty)` para reportar seu
 *     estado. O hook limpa o flag automaticamente ao desmontar (troca de aba).
 */
import { createContext, useContext, useEffect, useState } from "react";

interface AdminDirtyContextValue {
  isDirty: boolean;
  setIsDirty: (v: boolean) => void;
}

const AdminDirtyContext = createContext<AdminDirtyContextValue>({
  isDirty: false,
  setIsDirty: () => {},
});

export function AdminDirtyProvider({ children }: { children: React.ReactNode }) {
  const [isDirty, setIsDirty] = useState(false);
  return (
    <AdminDirtyContext.Provider value={{ isDirty, setIsDirty }}>
      {children}
    </AdminDirtyContext.Provider>
  );
}

export const useAdminDirty = () => useContext(AdminDirtyContext);

/** Reporta o estado dirty da seção atual; auto-clear no unmount. */
export function useReportDirty(isDirty: boolean) {
  const { setIsDirty } = useAdminDirty();
  useEffect(() => {
    setIsDirty(isDirty);
  }, [isDirty, setIsDirty]);
  useEffect(() => {
    return () => setIsDirty(false);
  }, [setIsDirty]);
}