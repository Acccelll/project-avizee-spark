import { describe, expect, it, vi, beforeEach } from "vitest";
import { Routes, Route } from "react-router-dom";
import { screen } from "@testing-library/react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { makeAuthState, renderWithSmokeProviders } from "./smokeTestUtils";

const mockUseAuth = vi.fn();
const mockUseIsAdmin = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/hooks/useIsAdmin", () => ({
  useIsAdmin: () => mockUseIsAdmin(),
}));

describe("smoke: autenticação, proteção de rota e acesso admin", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUseIsAdmin.mockReset();
  });

  it("redireciona usuário não autenticado para /login em rota protegida", async () => {
    mockUseAuth.mockReturnValue(makeAuthState({ user: null, permissionsLoaded: true }));

    renderWithSmokeProviders(
      <Routes>
        <Route path="/login" element={<div>Login Screen</div>} />
        <Route path="/" element={<ProtectedRoute><div>Área interna</div></ProtectedRoute>} />
      </Routes>,
      "/",
    );

    expect(await screen.findByText("Login Screen")).toBeInTheDocument();
  });

  it("libera rota protegida no bootstrap feliz de autenticação", async () => {
    mockUseAuth.mockReturnValue(makeAuthState());

    renderWithSmokeProviders(
      <Routes>
        <Route path="/" element={<ProtectedRoute><div>Dashboard interno</div></ProtectedRoute>} />
      </Routes>,
      "/",
    );

    expect(await screen.findByText("Dashboard interno")).toBeInTheDocument();
  });

  it("permite rota admin para admin e bloqueia não-admin", async () => {
    mockUseAuth.mockReturnValue(makeAuthState());

    mockUseIsAdmin.mockReturnValue({ isAdmin: false, loading: false });
    const nonAdmin = renderWithSmokeProviders(
      <Routes>
        <Route path="/" element={<div>Home</div>} />
        <Route path="/administracao" element={<AdminRoute><div>Painel Admin</div></AdminRoute>} />
      </Routes>,
      "/administracao",
    );
    expect(await screen.findByText("Home")).toBeInTheDocument();
    nonAdmin.unmount();

    mockUseIsAdmin.mockReturnValue({ isAdmin: true, loading: false });
    renderWithSmokeProviders(
      <Routes>
        <Route path="/" element={<div>Home</div>} />
        <Route path="/administracao" element={<AdminRoute><div>Painel Admin</div></AdminRoute>} />
      </Routes>,
      "/administracao",
    );

    expect(await screen.findByText("Painel Admin")).toBeInTheDocument();
  });
});
