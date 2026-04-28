import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchByIdGeneric } from "@/services/genericLookup.service";

/**
 * Centraliza o padrão de deep-link `?editId=<uuid>` (ou via `location.state.editId`)
 * usado pelas páginas de cadastro. Ao detectar o id, carrega o registro
 * via Supabase, dispara `onLoad(record)` e limpa o parâmetro da URL para
 * evitar reabertura ao navegar para trás.
 *
 * Tipagem `T` é apenas para o callback — a query é genérica em `select("*")`.
 */
export function useEditDeepLink<T = Record<string, unknown>>(opts: {
  table:
    | "clientes"
    | "fornecedores"
    | "produtos"
    | "transportadoras"
    | "funcionarios"
    | "grupos_economicos"
    | "formas_pagamento"
    | "unidades_medida";
  onLoad: (record: T) => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const stateEditId = (location.state as { editId?: string } | null)?.editId;
    const searchEditId = new URLSearchParams(location.search).get("editId");
    const editId = stateEditId || searchEditId;
    if (!editId) return;

    let cancelled = false;
    fetchByIdGeneric(opts.table, editId).then((data) => {
      if (cancelled) return;
      if (data) opts.onLoad(data as T);
      const nextSearch = new URLSearchParams(location.search);
      nextSearch.delete("editId");
      navigate(
        {
          pathname: location.pathname,
          search: nextSearch.toString() ? `?${nextSearch.toString()}` : "",
        },
        { replace: true, state: {} },
      );
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search, location.state]);
}
