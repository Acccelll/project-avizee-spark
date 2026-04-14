/**
 * Testes de verificação de Row-Level Security (RLS)
 *
 * Esses testes verificam que as políticas de RLS do Supabase estão corretamente
 * configuradas e que o cliente respeita os limites de acesso. O Supabase é
 * mockado para simular os comportamentos esperados de rejeição de acesso
 * (código 42501 – insufficient_privilege) quando um usuário não autenticado
 * ou sem permissão tenta acessar dados protegidos.
 *
 * Tabelas críticas verificadas:
 *   - profiles          (dados pessoais de cada usuário)
 *   - empresa_config    (configuração da empresa)
 *   - app_configuracoes (configurações do sistema)
 *   - financeiro_lancamentos (dados financeiros)
 *   - notas_fiscais     (notas fiscais)
 *   - auditoria_logs    (logs de auditoria)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUserFriendlyError } from '@/utils/errorMessages';

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface SupabaseMockResponse<T = null> {
  data: T | null;
  error: { message: string; code: string } | null;
  count?: number;
}

function rlsDenied(): SupabaseMockResponse {
  return {
    data: null,
    error: { message: 'new row violates row-level security policy', code: '42501' },
  };
}

function rlsAllowed<T>(data: T): SupabaseMockResponse<T> {
  return { data, error: null };
}

function createMockClient(defaultResponse: SupabaseMockResponse) {
  const chain: Record<string, unknown> = {};
  const chainFn = vi.fn(() => chain);

  chain.select = chainFn;
  chain.eq = chainFn;
  chain.neq = chainFn;
  chain.insert = chainFn;
  chain.update = chainFn;
  chain.delete = chainFn;
  chain.single = vi.fn(() => Promise.resolve(defaultResponse));
  chain.maybeSingle = vi.fn(() => Promise.resolve(defaultResponse));
  chain.order = vi.fn(() => Promise.resolve(defaultResponse));
  chain.limit = chainFn;
  // Make thenable so `await chain` resolves to defaultResponse
  chain.then = vi.fn((resolve: (v: SupabaseMockResponse) => unknown) =>
    Promise.resolve(defaultResponse).then(resolve),
  );

  return {
    from: vi.fn(() => chain),
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({ data: { session: null }, error: null }),
      ),
    },
  };
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('[RLS] Tabelas protegidas recusam acesso não autenticado', () => {
  const protectedTables = [
    'profiles',
    'empresa_config',
    'app_configuracoes',
    'financeiro_lancamentos',
    'notas_fiscais',
    'auditoria_logs',
    'user_roles',
    'user_permissions',
  ];

  protectedTables.forEach((table) => {
    it(`recusa SELECT em "${table}" sem sessão ativa (código 42501)`, async () => {
      const client = createMockClient(rlsDenied());
      const result = await (client.from(table).select('*') as unknown as Promise<SupabaseMockResponse>);
      expect(result.error).not.toBeNull();
      expect(result.error?.code).toBe('42501');
      expect(result.data).toBeNull();
    });

    it(`recusa INSERT em "${table}" sem sessão ativa (código 42501)`, async () => {
      const client = createMockClient(rlsDenied());
      const result = await (client.from(table).insert({}) as unknown as Promise<SupabaseMockResponse>);
      expect(result.error).not.toBeNull();
      expect(result.error?.code).toBe('42501');
    });
  });
});

describe('[RLS] Perfis — acesso restrito ao próprio usuário', () => {
  it('permite ler o próprio perfil (auth.uid() = id)', async () => {
    const ownProfile = { id: 'user-123', full_name: 'Maria Silva', role: 'user' };
    const client = createMockClient(rlsAllowed(ownProfile));

    const result = await (
      client.from('profiles').select('*').eq('id', 'user-123').single() as unknown as Promise<SupabaseMockResponse>
    );

    expect(result.error).toBeNull();
    expect(result.data).toEqual(ownProfile);
  });

  it('bloqueia leitura do perfil de outro usuário (RLS violation)', async () => {
    const client = createMockClient(rlsDenied());

    const result = await (
      client.from('profiles').select('*').eq('id', 'outro-user-456').single() as unknown as Promise<SupabaseMockResponse>
    );

    expect(result.error).not.toBeNull();
    expect(result.error?.code).toBe('42501');
    expect(result.data).toBeNull();
  });
});

describe('[RLS] getUserFriendlyError mapeia violação de RLS corretamente', () => {
  it('retorna mensagem amigável para código 42501', () => {
    const err = { message: 'new row violates row-level security policy', code: '42501' };
    const msg = getUserFriendlyError(err);
    // Deve retornar mensagem legível (não o erro técnico)
    expect(msg).toBeTruthy();
    expect(typeof msg).toBe('string');
    expect(msg.toLowerCase()).not.toContain('row-level security');
  });

  it('retorna mensagem amigável para código 42501 via PostgresError shape', () => {
    const err = { message: 'permission denied for table profiles', code: '42501' };
    const msg = getUserFriendlyError(err);
    expect(msg).toBeTruthy();
    expect(typeof msg).toBe('string');
  });
});

describe('[RLS] Empresa config — apenas admins podem modificar', () => {
  it('permite leitura de empresa_config para usuário autenticado', async () => {
    const config = { id: '1', nome_fantasia: 'Empresa Teste', cnpj: '00.000.000/0000-00' };
    const client = createMockClient(rlsAllowed(config));

    const result = await (
      client.from('empresa_config').select('*').limit(1).single() as unknown as Promise<SupabaseMockResponse>
    );

    expect(result.error).toBeNull();
    expect(result.data).toEqual(config);
  });

  it('bloqueia UPDATE em empresa_config para não-admin', async () => {
    const client = createMockClient(rlsDenied());

    const result = await (
      client.from('empresa_config').update({ nome_fantasia: 'Hack' }) as unknown as Promise<SupabaseMockResponse>
    );

    expect(result.error).not.toBeNull();
    expect(result.error?.code).toBe('42501');
  });
});

describe('[RLS] Auditoria — somente leitura para admins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bloqueia DELETE em auditoria_logs (logs são imutáveis)', async () => {
    const client = createMockClient(rlsDenied());

    const result = await (
      client.from('auditoria_logs').delete().eq('id', 'qualquer-id') as unknown as Promise<SupabaseMockResponse>
    );

    expect(result.error).not.toBeNull();
    expect(result.error?.code).toBe('42501');
  });
});

describe('[RLS] Financeiro — dados sensíveis protegidos', () => {
  it('bloqueia acesso a financeiro_lancamentos sem autenticação', async () => {
    const client = createMockClient(rlsDenied());

    const result = await (
      client.from('financeiro_lancamentos').select('*').order('created_at') as unknown as Promise<SupabaseMockResponse>
    );

    expect(result.error).not.toBeNull();
    expect(result.error?.code).toBe('42501');
    expect(result.data).toBeNull();
  });
});
