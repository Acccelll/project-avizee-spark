import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useAuth, AuthProvider } from "@/contexts/AuthContext";

const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockSignOut = vi.fn();
const mockFetchAuthProfile = vi.fn();
const mockFetchAuthRoles = vi.fn();
const mockFetchAuthPermissions = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  },
}));

vi.mock("@/services/auth.service", () => ({
  fetchAuthProfile: (...args: unknown[]) => mockFetchAuthProfile(...args),
  fetchAuthRoles: (...args: unknown[]) => mockFetchAuthRoles(...args),
  fetchAuthPermissions: (...args: unknown[]) => mockFetchAuthPermissions(...args),
}));

function AuthStateProbe() {
  const { loading, permissionsLoaded, user, roles, extraPermissions } = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="permissionsLoaded">{String(permissionsLoaded)}</div>
      <div data-testid="user">{user?.id ?? "anon"}</div>
      <div data-testid="roles">{roles.join(",")}</div>
      <div data-testid="allowed">{extraPermissions.join(",")}</div>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockOnAuthStateChange.mockReset();
    mockSignOut.mockReset();
    mockFetchAuthProfile.mockReset();
    mockFetchAuthRoles.mockReset();
    mockFetchAuthPermissions.mockReset();

    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  it("restaura a sessão inicial sem ficar preso em loading", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "user-1", email: "admin@avizee.com" },
          access_token: "token",
        },
      },
      error: null,
    });
    mockFetchAuthProfile.mockResolvedValue({ nome: "Administrador", email: "admin@avizee.com", cargo: null, avatar_url: null });
    mockFetchAuthRoles.mockResolvedValue(["admin"]);
    mockFetchAuthPermissions.mockResolvedValue({
      allowed: ["faturamento_fiscal:visualizar"],
      denied: [],
    });

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("permissionsLoaded")).toHaveTextContent("true");
    expect(screen.getByTestId("user")).toHaveTextContent("user-1");
    expect(screen.getByTestId("roles")).toHaveTextContent("admin");
    expect(screen.getByTestId("allowed")).toHaveTextContent("faturamento_fiscal:visualizar");
  });

  it("limpa o estado quando não há sessão restaurada", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("permissionsLoaded")).toHaveTextContent("false");
    expect(screen.getByTestId("user")).toHaveTextContent("anon");
  });
});
