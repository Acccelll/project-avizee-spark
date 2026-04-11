import { useState, useCallback } from "react";

export interface ContextMenuState<T> {
  anchorEl: HTMLElement | null;
  selectedRow: T | null;
}

export interface UseContextMenuReturn<T> {
  anchorEl: HTMLElement | null;
  selectedRow: T | null;
  isOpen: boolean;
  openMenu: (event: React.MouseEvent<HTMLElement>, row: T) => void;
  closeMenu: () => void;
}

export function useContextMenu<T>(): UseContextMenuReturn<T> {
  const [state, setState] = useState<ContextMenuState<T>>({
    anchorEl: null,
    selectedRow: null,
  });

  const openMenu = useCallback((event: React.MouseEvent<HTMLElement>, row: T) => {
    event.stopPropagation();
    setState({ anchorEl: event.currentTarget, selectedRow: row });
  }, []);

  const closeMenu = useCallback(() => {
    setState({ anchorEl: null, selectedRow: null });
  }, []);

  return {
    anchorEl: state.anchorEl,
    selectedRow: state.selectedRow,
    isOpen: state.anchorEl !== null,
    openMenu,
    closeMenu,
  };
}
