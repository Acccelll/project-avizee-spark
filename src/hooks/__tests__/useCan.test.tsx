import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCan } from "@/hooks/useCan";
import type { AppRole } from "@/contexts/AuthContext";

// ─── Mock do AuthContext ──────────────────────────────────────────────────────

const mockUseAuth = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Constrói o retorno simulado do useAuth para um dado conjunto de roles. */
function makeAuth(
  roles: AppRole[],
  extraPermissions: string[] = [],
  permissionsLoaded = true
) {
  return {
    user: { id: "user-1" },
    session: {},
    loading: false,
    permissionsLoaded,
    profile: null,
    roles,
    extraPermissions,
    deniedPermissions: [],
    hasRole: (r: AppRole) => roles.includes(r),
    signOut: vi.fn(),
  };
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe("useCan", () => {
  it("retorna loading=true enquanto permissões não foram carregadas", () => {
    mockUseAuth.mockReturnValue(makeAuth([], [], false));
    const { result } = renderHook(() => useCan());
    expect(result.current.loading).toBe(true);
  });

  it("retorna loading=false quando permissões foram carregadas", () => {
    mockUseAuth.mockReturnValue(makeAuth(["vendedor"]));
    const { result } = renderHook(() => useCan());
    expect(result.current.loading).toBe(false);
  });

  it("usuário admin tem acesso a todas as permissões", () => {
    mockUseAuth.mockReturnValue(makeAuth(["admin"]));
    const { result } = renderHook(() => useCan());
    const { can } = result.current;

    expect(can("usuarios:visualizar")).toBe(true);
    expect(can("usuarios:criar")).toBe(true);
    expect(can("financeiro:excluir")).toBe(true);
    expect(can("relatorios:exportar")).toBe(true);
  });

  it("retorna true para permissão específica concedida ao papel", () => {
    mockUseAuth.mockReturnValue(makeAuth(["vendedor"]));
    const { result } = renderHook(() => useCan());
    expect(result.current.can("dashboard:visualizar")).toBe(true);
    expect(result.current.can("clientes:visualizar")).toBe(true);
  });

  it("retorna false para permissão não concedida ao papel", () => {
    mockUseAuth.mockReturnValue(makeAuth(["vendedor"]));
    const { result } = renderHook(() => useCan());
    expect(result.current.can("financeiro:editar")).toBe(false);
    expect(result.current.can("usuarios:criar")).toBe(false);
  });

  it("retorna false para todas as permissões quando permissões ainda não carregaram", () => {
    mockUseAuth.mockReturnValue(makeAuth(["admin"], [], false));
    const { result } = renderHook(() => useCan());
    expect(result.current.can("usuarios:criar")).toBe(false);
  });

  it("suporta permissões extras além do papel base", () => {
    mockUseAuth.mockReturnValue(
      makeAuth(["vendedor"], ["estoque:visualizar" as AppRole])
    );
    const { result } = renderHook(() => useCan());
    expect(result.current.can("estoque:visualizar")).toBe(true);
  });

  it("suporta wildcard de recurso quando usuário possui permissão extra com wildcard", () => {
    mockUseAuth.mockReturnValue(
      makeAuth(["vendedor"], ["relatorios:*" as AppRole])
    );
    const { result } = renderHook(() => useCan());
    expect(result.current.can("relatorios:exportar")).toBe(true);
    expect(result.current.can("relatorios:visualizar")).toBe(true);
  });

  it("papel financeiro tem acesso a financeiro mas não a usuarios", () => {
    mockUseAuth.mockReturnValue(makeAuth(["financeiro"]));
    const { result } = renderHook(() => useCan());
    expect(result.current.can("financeiro:visualizar")).toBe(true);
    expect(result.current.can("usuarios:criar")).toBe(false);
  });

  it("papel estoquista tem acesso a estoque mas não a financeiro", () => {
    mockUseAuth.mockReturnValue(makeAuth(["estoquista"]));
    const { result } = renderHook(() => useCan());
    expect(result.current.can("estoque:visualizar")).toBe(true);
    expect(result.current.can("financeiro:editar")).toBe(false);
  });
});
