import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from "@/integrations/supabase/client";
import { listarSessoes, revogarSessao } from "../sessoes.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildSession(overrides = {}) {
  return {
    id: "session-1",
    user_id: "user-1",
    created_at: "2026-04-01T10:00:00Z",
    last_active_at: "2026-04-10T10:00:00Z",
    ip_address: "192.168.1.1",
    user_agent: "Mozilla/5.0",
    is_active: true,
    ...overrides,
  };
}

/**
 * Cria um mock de chain do Supabase que é awaitable e encadeia `.eq()` / `.order()` / `.select()`.
 * `resolvedValue` é o que `await chain` resolve.
 */
function buildSelectChain(resolvedValue: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  // Torna o objeto awaitable — `await chain` chama `then()`
  chain.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
    Promise.resolve(resolvedValue).then(resolve, reject);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  return chain;
}

function buildUpdateChain(resolvedValue: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
    Promise.resolve(resolvedValue).then(resolve, reject);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  return chain;
}

// ─── listarSessoes ────────────────────────────────────────────────────────────

describe("listarSessoes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna lista de sessões quando a query é bem-sucedida", async () => {
    const sessions = [buildSession(), buildSession({ id: "session-2", user_id: "user-2" })];
    const chain = buildSelectChain({ data: sessions, error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as ReturnType<typeof supabase.from>);

    const result = await listarSessoes({ apenasAtivas: false });

    expect(supabase.from).toHaveBeenCalledWith("user_sessions");
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("session-1");
  });

  it("filtra por is_active=true quando apenasAtivas é true (padrão)", async () => {
    const sessions = [buildSession()];
    const chain = buildSelectChain({ data: sessions, error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as ReturnType<typeof supabase.from>);

    const result = await listarSessoes();

    expect(chain.eq).toHaveBeenCalledWith("is_active", true);
    expect(result).toHaveLength(1);
  });

  it("filtra por user_id quando userId é fornecido", async () => {
    const sessions = [buildSession({ user_id: "user-42" })];
    const chain = buildSelectChain({ data: sessions, error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as ReturnType<typeof supabase.from>);

    const result = await listarSessoes({ userId: "user-42" });

    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-42");
    expect(result[0].user_id).toBe("user-42");
  });

  it("retorna array vazio quando data é null", async () => {
    const chain = buildSelectChain({ data: null, error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as ReturnType<typeof supabase.from>);

    const result = await listarSessoes({ apenasAtivas: false });

    expect(result).toEqual([]);
  });

  it("lança erro quando a query retorna erro", async () => {
    const dbError = new Error("DB error");
    const chain = buildSelectChain({ data: null, error: dbError });
    vi.mocked(supabase.from).mockReturnValue(chain as ReturnType<typeof supabase.from>);

    await expect(listarSessoes({ apenasAtivas: false })).rejects.toThrow("DB error");
  });
});

// ─── revogarSessao ────────────────────────────────────────────────────────────

describe("revogarSessao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("atualiza is_active para false para o sessionId informado", async () => {
    const chain = buildUpdateChain({ data: null, error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as ReturnType<typeof supabase.from>);

    await revogarSessao("session-abc");

    expect(supabase.from).toHaveBeenCalledWith("user_sessions");
    expect(chain.update).toHaveBeenCalledWith({ is_active: false });
    expect(chain.eq).toHaveBeenCalledWith("id", "session-abc");
  });

  it("resolve sem erro em caso de sucesso", async () => {
    const chain = buildUpdateChain({ data: null, error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as ReturnType<typeof supabase.from>);

    await expect(revogarSessao("session-xyz")).resolves.toBeUndefined();
  });

  it("lança erro quando o update falha", async () => {
    const dbError = new Error("Update failed");
    const chain = buildUpdateChain({ data: null, error: dbError });
    vi.mocked(supabase.from).mockReturnValue(chain as ReturnType<typeof supabase.from>);

    await expect(revogarSessao("session-bad")).rejects.toThrow("Update failed");
  });
});
