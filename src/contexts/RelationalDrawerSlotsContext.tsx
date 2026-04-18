import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";

/**
 * Slots que cada *View relacional pode publicar para o cabeçalho do drawer no qual está renderizada.
 * O RelationalDrawerStack lê esses slots e os injeta no DrawerHeaderShell, evitando duplicação
 * de cabeçalhos (cada View NÃO renderiza mais o próprio identity card / action bar).
 */
export interface RelationalDrawerSlots {
  /** Linha de breadcrumb adicional ("Cadastros > Produtos · cx001"). */
  breadcrumb?: ReactNode;
  /** Faixa de resumo do registro (identity card, KPIs, status). */
  summary?: ReactNode;
  /** Linha de ações do registro (Editar, Excluir, etc.). */
  actions?: ReactNode;
}

interface SlotsRegistry {
  setSlots: (key: string, slots: RelationalDrawerSlots | null) => void;
  getSlots: (key: string) => RelationalDrawerSlots | undefined;
  /** Retorna um número que muda quando qualquer slot é atualizado — força re-render do consumidor. */
  version: number;
}

const SlotsContext = createContext<SlotsRegistry | undefined>(undefined);

export function RelationalDrawerSlotsProvider({ children }: { children: ReactNode }) {
  const slotsRef = useRef<Map<string, RelationalDrawerSlots>>(new Map());
  const [version, setVersion] = useState(0);

  const value = useMemo<SlotsRegistry>(
    () => ({
      version,
      setSlots: (key, slots) => {
        if (slots === null) {
          slotsRef.current.delete(key);
        } else {
          slotsRef.current.set(key, slots);
        }
        setVersion((v) => v + 1);
      },
      getSlots: (key) => slotsRef.current.get(key),
    }),
    [version],
  );

  return <SlotsContext.Provider value={value}>{children}</SlotsContext.Provider>;
}

/**
 * Hook usado por cada *View para publicar seus slots no drawer correspondente.
 * Os slots ficam ativos enquanto o componente estiver montado.
 *
 * IMPORTANTE: a key deve ser estável e única para cada drawer (ex: "produto:abc-123").
 */
// eslint-disable-next-line react-refresh/only-export-components
export function usePublishDrawerSlots(key: string, slots: RelationalDrawerSlots) {
  const ctx = useContext(SlotsContext);
  // Serialize via JSON para detectar mudança real de conteúdo (slots são ReactNode — referência muda a cada render)
  // Mas como ReactNode não serializa, usamos uma key estável + atualizamos sempre.
  useEffect(() => {
    if (!ctx) return;
    ctx.setSlots(key, slots);
    return () => {
      ctx.setSlots(key, null);
    };
    // Re-publicar a cada render do consumidor
  });
}

/**
 * Hook usado pelo RelationalDrawerStack para consumir os slots publicados.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useDrawerSlots(key: string): RelationalDrawerSlots | undefined {
  const ctx = useContext(SlotsContext);
  // Subscribe to version → re-render quando qualquer slot mudar
  void ctx?.version;
  return ctx?.getSlots(key);
}
