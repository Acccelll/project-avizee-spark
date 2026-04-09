import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import OrcamentoForm from "@/pages/OrcamentoForm";

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("html2canvas", () => ({ default: vi.fn() }));
vi.mock("jspdf", () => ({ default: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({}),
  };
});

function createQueryResult() {
  const query: any = {
    select: vi.fn((_: string, options?: { head?: boolean }) => {
      if (options?.head) {
        return Promise.resolve({ count: 0, error: null });
      }
      return query;
    }),
    eq: vi.fn(() => query),
    order: vi.fn(() => Promise.resolve({ data: [], error: null })),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
  };

  return query;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => createQueryResult(),
  },
}));

describe("OrcamentoForm", () => {
  it("deve renderizar a tela de nova cotação", async () => {
    render(
      <MemoryRouter>
        <OrcamentoForm />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/novo orçamento/i)).toBeInTheDocument();
    });
  });
});
