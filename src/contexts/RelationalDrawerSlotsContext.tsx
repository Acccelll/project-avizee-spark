import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useSyncExternalStore } from "react";

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
  /**
   * Subscrição estilo `useSyncExternalStore`: notifica apenas quando o slot
   * de uma chave específica muda — evita re-render de todos os DrawerSlots
   * (que era o efeito do `version++` global anterior).
   */
  subscribe: (key: string, listener: () => void) => () => void;
  getSlots: (key: string) => RelationalDrawerSlots | undefined;
}

const SlotsContext = createContext<SlotsRegistry | undefined>(undefined);

function shallowEqualSlots(a?: RelationalDrawerSlots, b?: RelationalDrawerSlots) {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.breadcrumb === b.breadcrumb && a.summary === b.summary && a.actions === b.actions;
}

export function RelationalDrawerSlotsProvider({ children }: { children: ReactNode }) {
  const slotsRef = useRef<Map<string, RelationalDrawerSlots>>(new Map());
  const listenersRef = useRef<Map<string, Set<() => void>>>(new Map());

  const value = useMemo<SlotsRegistry>(
    () => ({
      setSlots: (key, slots) => {
        const current = slotsRef.current.get(key);
        // Comparação shallow: ignora re-publicações idênticas vindas de re-renders.
        // Antes, todo render de uma View disparava setVersion → loop de renders.
        if (slots === null) {
          if (!current) return;
          slotsRef.current.delete(key);
        } else {
          if (shallowEqualSlots(current, slots)) return;
          slotsRef.current.set(key, slots);
        }
        const listeners = listenersRef.current.get(key);
        listeners?.forEach((l) => l());
      },
      subscribe: (key, listener) => {
        let set = listenersRef.current.get(key);
        if (!set) {
          set = new Set();
          listenersRef.current.set(key, set);
        }
        set.add(listener);
        return () => {
          set?.delete(listener);
          if (set && set.size === 0) listenersRef.current.delete(key);
        };
      },
      getSlots: (key) => slotsRef.current.get(key),
    }),
    [],
  );

  return <SlotsContext.Provider value={value}>{children}</SlotsContext.Provider>;
}

/**
 * Hook usado por cada *View para publicar seus slots no drawer correspondente.
 * Os slots ficam ativos enquanto o componente estiver montado.
 *
 * IMPORTANTE: a key deve ser estável e única para cada drawer (ex: "produto:abc-123").
 * O provider compara shallow e ignora updates redundantes — evita loops de render.
 */
export function usePublishDrawerSlots(key: string, slots: RelationalDrawerSlots) {
  const ctx = useContext(SlotsContext);
  // Publica diretamente no render: o provider deduplica via shallowEqualSlots,
  // então isto NÃO causa loop. Vantagem sobre useEffect: o consumidor já vê
  // o conteúdo atualizado no mesmo frame, sem flicker entre render → effect.
  if (ctx) {
    ctx.setSlots(key, slots);
  }
  // Cleanup ao desmontar.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useMemo(() => () => ctx?.setSlots(key, null), [ctx, key]);
}

/**
 * Hook usado pelo RelationalDrawerStack para consumir os slots publicados.
 * Re-renderiza APENAS quando o slot daquela `key` específica muda.
 */
export function useDrawerSlots(key: string): RelationalDrawerSlots | undefined {
  const ctx = useContext(SlotsContext);
  const subscribe = useCallback(
    (listener: () => void) => (ctx ? ctx.subscribe(key, listener) : () => {}),
    [ctx, key],
  );
  const getSnapshot = useCallback(() => ctx?.getSlots(key), [ctx, key]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
