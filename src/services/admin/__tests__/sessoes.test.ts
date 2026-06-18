import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

import { supabase } from "@/integrations/supabase/client";
import { listarSessoes, revogarSessao } from "../sessoes.service";

/**
 * Após a migração para a Edge Function `admin-sessions`, o serviço delega
 * toda a leitura/escrita ao `supabase.functions.invoke`. Os testes abaixo
 * espelham essa nova superfície (apenas `invoke`).
 */

function buildEdgeSessao(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-1",
    user_id: "user-1",
    user_email: "user1@empresa.com",
    user_name: "User 1",
    created_at: "2026-04-01T10:00:00Z",
    last_sign_in_at: "2026-04-10T10:00:00Z",
    user_agent: "Mozilla/5.0",
    ip: "192.168.1.1",
    ...overrides,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const invokeMock = supabase.functions.invoke as any;

describe("listarSessoes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna lista de sessões quando a edge function responde com sucesso", async () => {
    const data = [
      buildEdgeSessao(),
      buildEdgeSessao({
        id: "session-2",
        user_id: "user-2",
        last_sign_in_at: "2026-04-09T10:00:00Z",
      }),
    ];
    invokeMock.mockResolvedValue({ data, error: null });

    const result = await listarSessoes({ apenasAtivas: false });

    expect(invokeMock).toHaveBeenCalledWith("admin-sessions", { body: { action: "list" } });
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("session-1");
  });

  it("filtra por user_id quando userId é fornecido", async () => {
    const data = [
      buildEdgeSessao({ id: "s1", user_id: "user-42" }),
      buildEdgeSessao({ id: "s2", user_id: "outro" }),
    ];
    invokeMock.mockResolvedValue({ data, error: null });

    const result = await listarSessoes({ userId: "user-42", apenasAtivas: false });

    expect(result).toHaveLength(1);
    expect(result[0].user_id).toBe("user-42");
  });

  it("retorna array vazio quando data é null", async () => {
    invokeMock.mockResolvedValue({ data: null, error: null });
    const result = await listarSessoes({ apenasAtivas: false });
    expect(result).toEqual([]);
  });

  it("lança erro quando a edge function retorna erro", async () => {
    invokeMock.mockResolvedValue({ data: null, error: { message: "DB error" } });
    await expect(listarSessoes({ apenasAtivas: false })).rejects.toThrow("DB error");
  });
});

describe("revogarSessao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invoca admin-sessions com action=revoke e o userId informado", async () => {
    invokeMock.mockResolvedValue({ data: null, error: null });
    await revogarSessao("user-abc");
    expect(invokeMock).toHaveBeenCalledWith("admin-sessions", {
      body: { action: "revoke", userId: "user-abc" },
    });
  });

  it("resolve sem erro em caso de sucesso", async () => {
    invokeMock.mockResolvedValue({ data: null, error: null });
    await expect(revogarSessao("user-xyz")).resolves.toBeUndefined();
  });

  it("lança erro quando a edge function falha", async () => {
    invokeMock.mockResolvedValue({ data: null, error: { message: "Update failed" } });
    await expect(revogarSessao("user-bad")).rejects.toThrow("Update failed");
  });
});
