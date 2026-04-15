import type { PropsWithChildren, ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { render } from "@testing-library/react";
import type { AppRole } from "@/contexts/AuthContext";

export interface MockAuthState {
  user: { id: string; email?: string } | null;
  loading?: boolean;
  permissionsLoaded?: boolean;
  roles?: AppRole[];
}

export function makeAuthState(overrides: Partial<MockAuthState> = {}) {
  const roles = overrides.roles ?? [];

  return {
    user: overrides.user ?? { id: "user-1", email: "user@empresa.com" },
    session: overrides.user ? ({ user: overrides.user } as unknown) : null,
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

export function renderWithSmokeProviders(ui: ReactElement, route = "/") {
  const queryClient = createTestQueryClient();

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper });
}
