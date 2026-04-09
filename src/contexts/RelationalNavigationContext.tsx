import React, { createContext, useContext, useCallback, useEffect, useMemo, useReducer, useRef, ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

export const MAX_DRAWER_DEPTH = 5;

export type EntityType =
  | "produto"
  | "cliente"
  | "fornecedor"
  | "orcamento"
  | "pedido_compra"
  | "nota_fiscal"
  | "remessa"
  | "ordem_venda";

const VALID_ENTITY_TYPES: ReadonlyArray<EntityType> = ["produto", "cliente", "fornecedor", "orcamento", "pedido_compra", "nota_fiscal", "remessa", "ordem_venda"];

export interface ViewState {
  type: EntityType;
  id: string;
}

interface State {
  stack: ViewState[];
  pendingPush: ViewState | null;
}

type Action =
  | { type: "set_stack"; payload: ViewState[] }
  | { type: "request_push"; payload: ViewState }
  | { type: "confirm_push" }
  | { type: "cancel_push" }
  | { type: "pop" }
  | { type: "clear" };

interface RelationalNavigationContextType {
  stack: ViewState[];
  canPush: boolean;
  pendingPush: ViewState | null;
  pushView: (type: EntityType, id: string) => void;
  confirmPendingPush: () => void;
  cancelPendingPush: () => void;
  popView: () => void;
  clearStack: () => void;
}

function encodeDrawerParam(view: ViewState): string {
  return `${view.type}:${view.id}`;
}

function decodeDrawerParam(value: string): ViewState | null {
  const colonIndex = value.indexOf(":");
  if (colonIndex === -1) return null;
  const type = value.slice(0, colonIndex) as EntityType;
  const id = value.slice(colonIndex + 1);
  if (!VALID_ENTITY_TYPES.includes(type) || !id) return null;
  return { type, id };
}

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "set_stack":
      return { ...state, stack: action.payload.slice(0, MAX_DRAWER_DEPTH) };
    case "request_push":
      if (state.stack.length < MAX_DRAWER_DEPTH) {
        return { ...state, stack: [...state.stack, action.payload] };
      }
      return { ...state, pendingPush: action.payload };
    case "confirm_push": {
      if (!state.pendingPush) return state;
      const next = [...state.stack, state.pendingPush];
      return { stack: next.slice(next.length - MAX_DRAWER_DEPTH), pendingPush: null };
    }
    case "cancel_push":
      return { ...state, pendingPush: null };
    case "pop":
      return { ...state, stack: state.stack.slice(0, -1) };
    case "clear":
      return { stack: [], pendingPush: null };
    default:
      return state;
  }
};

const RelationalNavigationContext = createContext<RelationalNavigationContextType | undefined>(undefined);

export function RelationalNavigationProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();

  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const drawerParams = searchParams.getAll("drawer");
    const parsed = drawerParams.map(decodeDrawerParam).filter(Boolean) as ViewState[];
    return { stack: parsed.slice(0, MAX_DRAWER_DEPTH), pendingPush: null };
  });

  const stackRef = useRef(state.stack);
  stackRef.current = state.stack;

  const serializedStack = useMemo(() => state.stack.map(encodeDrawerParam).join("|"), [state.stack]);

  useEffect(() => {
    setSearchParams((prev) => {
      const existing = prev.getAll("drawer").join("|");
      if (existing === serializedStack) return prev;
      const next = new URLSearchParams(prev);
      next.delete("drawer");
      state.stack.forEach((v) => next.append("drawer", encodeDrawerParam(v)));
      return next;
    }, { replace: true });
  }, [serializedStack, state.stack, setSearchParams]);

  useEffect(() => {
    const onPopState = () => {
      const drawers = new URLSearchParams(window.location.search).getAll("drawer");
      const parsed = drawers.map(decodeDrawerParam).filter(Boolean) as ViewState[];
      const nextSerialized = parsed.map(encodeDrawerParam).join("|");
      if (nextSerialized !== serializedStack) {
        dispatch({ type: "set_stack", payload: parsed });
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [serializedStack]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (stackRef.current.length === 0) return;
      if (e.shiftKey) {
        e.stopImmediatePropagation();
        dispatch({ type: "clear" });
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  const pushView = useCallback((type: EntityType, id: string) => {
    if (!id || id === "undefined") {
      console.warn(`[RelationalNavigation] pushView("${type}") called with invalid id: ${JSON.stringify(id)}. Ignoring.`);
      return;
    }
    dispatch({ type: "request_push", payload: { type, id } });
  }, []);
  const popView = useCallback(() => dispatch({ type: "pop" }), []);
  const clearStack = useCallback(() => dispatch({ type: "clear" }), []);
  const confirmPendingPush = useCallback(() => dispatch({ type: "confirm_push" }), []);
  const cancelPendingPush = useCallback(() => dispatch({ type: "cancel_push" }), []);

  const value = useMemo(
    () => ({
      stack: state.stack,
      canPush: state.stack.length < MAX_DRAWER_DEPTH,
      pendingPush: state.pendingPush,
      pushView,
      confirmPendingPush,
      cancelPendingPush,
      popView,
      clearStack,
    }),
    [state.stack, state.pendingPush, pushView, confirmPendingPush, cancelPendingPush, popView, clearStack],
  );

  return <RelationalNavigationContext.Provider value={value}>{children}</RelationalNavigationContext.Provider>;
}

export function useRelationalNavigation() {
  const context = useContext(RelationalNavigationContext);
  if (context === undefined) throw new Error("useRelationalNavigation must be used within a RelationalNavigationProvider");
  return context;
}
