import type { PropsWithChildren, ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { render } from "@testing-library/react";
import { RelationalNavigationProvider } from "@/contexts/RelationalNavigationContext";
import type { AppRole } from "@/contexts/AuthContext";

export interface MockAuthState {
  user: { id: string; email?: string } | null;
  loading?: boolean;
  permissionsLoaded?: boolean;
  roles?: AppRole[];
}

export function makeAuthState(overrides: Partial<MockAuthState> = {}) {
  const roles = overrides.roles ?? [];
  const user = "user" in overrides ? overrides.user : { id: "user-1", email: "user@empresa.com" };

  return {
    user,
    session: user ? ({ user } as unknown) : null,
    loading: overrides.loading ?? false,
    permissionsLoaded: overrides.permissionsLoaded ?? true,
    profile: { nome: "Usuário Teste", email: "user@empresa.com", cargo: "Operador", avatar_url: "" },
    roles,
    extraPermissions: [],
    hasRole: (role: AppRole) => roles.includes(role),
    can: () => true,
    signOut: async () => {},
  };
}

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

interface SmokeProviderOptions {
  /** Include RelationalNavigationProvider. Default: false */
  relationalNav?: boolean;
}

export function renderWithSmokeProviders(ui: ReactElement, route = "/", options: SmokeProviderOptions = {}) {
  const queryClient = createTestQueryClient();
  const { relationalNav = false } = options;

  function Wrapper({ children }: PropsWithChildren) {
    const inner = relationalNav
      ? <RelationalNavigationProvider>{children}</RelationalNavigationProvider>
      : children;

    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          {inner}
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper });
}
