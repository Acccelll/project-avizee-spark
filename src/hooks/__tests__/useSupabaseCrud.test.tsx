import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSupabaseCrud } from "@/hooks/useSupabaseCrud";

const { fromMock, successToast, errorToast } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  successToast: vi.fn(),
  errorToast: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: successToast,
    error: errorToast,
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
  },
}));

type Row = { id: string; nome: string; ativo: boolean };

type QueryMock = {
  __selectedId: string | null;
  __payload: Partial<Row> | null;
  __inserted: Row | null;
  __operation: "update" | "delete" | null;
  select: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  then: (resolve: (value: { data: Row[]; error: null; count: number }) => void) => void;
};

function createQueryMock(initialData: Row[] = []) {
  let rows = [...initialData];

  const query = {} as QueryMock;

  const applyPendingMutation = () => {
    if (query.__operation === "update" && query.__selectedId) {
      rows = rows.map((row) => (row.id === query.__selectedId ? { ...row, ...query.__payload } : row));
      query.__operation = null;
      query.__payload = null;
    }

    if (query.__operation === "delete" && query.__selectedId) {
      rows = rows.filter((row) => row.id !== query.__selectedId);
      query.__operation = null;
    }
  };

  Object.assign(query, {
    __selectedId: null,
    __payload: null,
    __inserted: null,
    __operation: null,
    select: vi.fn(() => query),
    order: vi.fn(() => query),
    eq: vi.fn((column: string, value: string) => {
      if (column === "id") {
        query.__selectedId = value;
        applyPendingMutation();
      }
      return query;
    }),
    update: vi.fn((payload: Partial<Row>) => {
      query.__payload = payload;
      query.__operation = "update";
      return query;
    }),
    insert: vi.fn((payload: Partial<Row>) => {
      const newItem = { id: "novo-id", nome: payload.nome ?? "", ativo: payload.ativo ?? true };
      rows = [...rows, newItem];
      query.__inserted = newItem;
      return query;
    }),
    delete: vi.fn(() => {
      query.__operation = "delete";
      return query;
    }),
    single: vi.fn(() => Promise.resolve({ data: query.__inserted || rows.find((row) => row.id === query.__selectedId) || null, error: null })),
    then: (resolve: (value: { data: Row[]; error: null; count: number }) => void) => resolve({ data: rows, error: null, count: rows.length }),
  });

  return { query, getRows: () => rows };
}

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe("useSupabaseCrud", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve carregar dados iniciais e criar registro", async () => {
    const { query, getRows } = createQueryMock([{ id: "1", nome: "Produto A", ativo: true }]);
    fromMock.mockReturnValue(query);

    const { result } = renderHook(() => useSupabaseCrud<Row>({ table: "produtos" }), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toHaveLength(1);

    await act(async () => {
      await result.current.create({ nome: "Produto B", ativo: true });
    });

    await waitFor(() => expect(getRows()).toHaveLength(2));
    expect(successToast).toHaveBeenCalledWith("Registro criado com sucesso!");
  });

  it("deve fazer soft delete quando ativo estiver habilitado", async () => {
    const { query, getRows } = createQueryMock([{ id: "1", nome: "Produto A", ativo: true }]);
    fromMock.mockReturnValue(query);

    const { result } = renderHook(() => useSupabaseCrud<Row>({ table: "produtos" }), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.remove("1", true);
    });

    expect(getRows()[0].ativo).toBe(false);
    expect(successToast).toHaveBeenCalledWith("Registro removido com sucesso!");
  });
});
