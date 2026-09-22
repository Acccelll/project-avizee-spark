import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNotasFiscaisPaged } from "@/pages/fiscal/hooks/useNotasFiscaisPaged";

const { fetchPaged } = vi.hoisted(() => ({
  fetchPaged: vi.fn(),
}));

vi.mock("@/services/fiscal/notasFiscaisPaged.service", () => ({
  fetchNotasFiscaisPaged: fetchPaged,
}));

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

describe("useNotasFiscaisPaged — exportação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchPaged.mockImplementation(async (args: { limit: number; offset: number }) => {
      if (args.limit === 1000 && args.offset === 0) {
        return {
          rows: [
            { id: "nf-1", numero: "1" },
            { id: "nf-2", numero: "2" },
            { id: "nf-3", numero: "3" },
          ],
          totalCount: 3,
        };
      }
      return { rows: [{ id: "nf-2", numero: "2" }], totalCount: 3 };
    });
  });

  it("fetchAllRows usa os mesmos filtros e sort sem ficar preso à página visível", async () => {
    const filters = {
      dateFrom: "2026-09-01",
      dateTo: "2026-09-30",
      tipos: ["entrada"],
      search: "avi",
    };

    const { result } = renderHook(
      () => useNotasFiscaisPaged(filters, 1, 1, { orderBy: "numero", ascending: true }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    let rows: unknown[] = [];
    await act(async () => {
      rows = await result.current.fetchAllRows();
    });

    expect(rows).toHaveLength(3);
    expect(fetchPaged).toHaveBeenCalledWith(
      expect.objectContaining({
        dateFrom: "2026-09-01",
        dateTo: "2026-09-30",
        tipos: ["entrada"],
        search: "avi",
        orderBy: "numero",
        ascending: true,
        offset: 0,
        limit: 1000,
      }),
    );
  });
});
