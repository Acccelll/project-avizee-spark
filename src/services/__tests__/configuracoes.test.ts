import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ConfigEmail, ConfigIntegracao } from '@/utils/configuracoes';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn() },
}));

vi.mock('@/services/admin/audit.service', () => ({
  registrarAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import {
  testarConexaoSMTP,
  testarGatewayPagamento,
  testarApiSefaz,
} from '../../pages/configuracoes/services/configuracoes.service';

const validEmail: ConfigEmail = {
  smtp_host: 'smtp.example.com',
  smtp_porta: 587,
  smtp_usuario: 'user@example.com',
  smtp_senha: 'secret',
  smtp_ssl: true,
  remetente_nome: 'Avizee',
  remetente_email: 'no-reply@example.com',
};

const validIntegracao: ConfigIntegracao = {
  gateway_pagamento: 'stripe',
  gateway_api_key: 'pk_live_abc',
  gateway_secret_key: 'sk_live_xyz',
  sefaz_ambiente: 'homologacao',
  sefaz_certificado: '',
  sefaz_senha_certificado: '',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('testarConexaoSMTP', () => {
  it('returns sucesso: true for valid config', async () => {
    const result = await testarConexaoSMTP(validEmail);
    expect(result.sucesso).toBe(true);
    expect(result.mensagem).toBeTruthy();
  });

  it('returns sucesso: false when smtp_host is empty', async () => {
    const result = await testarConexaoSMTP({ ...validEmail, smtp_host: '' });
    expect(result.sucesso).toBe(false);
    expect(result.mensagem).toBeTruthy();
  });

  it('returns sucesso: false when smtp_porta is invalid', async () => {
    const result = await testarConexaoSMTP({ ...validEmail, smtp_porta: 99999 });
    expect(result.sucesso).toBe(false);
  });

  it('returns sucesso: false when smtp_usuario is empty', async () => {
    const result = await testarConexaoSMTP({ ...validEmail, smtp_usuario: '' });
    expect(result.sucesso).toBe(false);
  });
});

describe('testarGatewayPagamento', () => {
  it('returns sucesso: true for valid config', async () => {
    const result = await testarGatewayPagamento(validIntegracao);
    expect(result.sucesso).toBe(true);
  });

  it('returns sucesso: false when api_key is empty', async () => {
    const result = await testarGatewayPagamento({ ...validIntegracao, gateway_api_key: '' });
    expect(result.sucesso).toBe(false);
    expect(result.mensagem).toBeTruthy();
  });

  it('returns sucesso: false when secret_key is empty', async () => {
    const result = await testarGatewayPagamento({ ...validIntegracao, gateway_secret_key: '' });
    expect(result.sucesso).toBe(false);
  });
});

describe('testarApiSefaz', () => {
  it('returns sucesso: true for homologacao ambiente', async () => {
    const result = await testarApiSefaz({ ...validIntegracao, sefaz_ambiente: 'homologacao' });
    expect(result.sucesso).toBe(true);
    expect(result.mensagem).toContain('homologação');
  });

  it('returns sucesso: true for producao ambiente', async () => {
    const result = await testarApiSefaz({ ...validIntegracao, sefaz_ambiente: 'producao' });
    expect(result.sucesso).toBe(true);
    expect(result.mensagem).toContain('produção');
  });
});
