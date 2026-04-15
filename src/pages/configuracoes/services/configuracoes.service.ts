import { supabase } from '@/integrations/supabase/client';
import { registrarAuditLog } from '@/services/admin/audit.service';
import type { ConfigEmail, ConfigIntegracao } from '@/utils/configuracoes';

export type ConfigChave = 'geral' | 'email' | 'integracoes' | 'notificacoes' | 'backup';

export async function fetchConfig<T>(chave: ConfigChave): Promise<T> {
  const { data, error } = await supabase
    .from('app_configuracoes')
    .select('valor')
    .eq('chave', chave)
    .maybeSingle();

  if (error) throw error;
  return ((data?.valor ?? {}) as unknown) as T;
}

export async function updateConfig(
  chave: ConfigChave,
  valor: Record<string, unknown>,
  usuarioId: string | undefined
): Promise<void> {
  const { data: existingData } = await supabase
    .from('app_configuracoes')
    .select('valor')
    .eq('chave', chave)
    .maybeSingle();

  const oldValue = existingData?.valor ?? null;

  const { error } = await supabase
    .from('app_configuracoes')
    .upsert({ chave, valor: valor as any } as any, { onConflict: 'chave' });

  if (error) throw error;

  await registrarAuditLog({
    acao: 'configuracao:update',
    tabela: 'app_configuracoes',
    registro_id: chave,
    dados_anteriores: oldValue as any,
    dados_novos: valor as any,
    usuario_id: usuarioId ?? null,
  });
}

export async function testarConexaoSMTP(
  config: ConfigEmail
): Promise<{ sucesso: boolean; mensagem: string }> {
  if (!config.smtp_host || config.smtp_host.trim() === '') {
    return { sucesso: false, mensagem: 'Host SMTP não configurado.' };
  }
  if (!config.smtp_porta || config.smtp_porta <= 0 || config.smtp_porta > 65535) {
    return { sucesso: false, mensagem: 'Porta SMTP inválida.' };
  }
  if (!config.smtp_usuario || config.smtp_usuario.trim() === '') {
    return { sucesso: false, mensagem: 'Usuário SMTP não configurado.' };
  }

  const { data, error } = await supabase.functions.invoke('test-smtp', {
    body: {
      host: config.smtp_host,
      porta: config.smtp_porta,
      usuario: config.smtp_usuario,
      senha: config.smtp_senha,
      ssl: config.smtp_ssl,
    },
  });
  if (error) return { sucesso: false, mensagem: error.message };
  return data as { sucesso: boolean; mensagem: string };
}

export async function testarGatewayPagamento(
  config: ConfigIntegracao
): Promise<{ sucesso: boolean; mensagem: string }> {
  if (!config.gateway_api_key || config.gateway_api_key.trim() === '') {
    return { sucesso: false, mensagem: 'API Key do gateway não configurada.' };
  }
  if (!config.gateway_secret_key || config.gateway_secret_key.trim() === '') {
    return { sucesso: false, mensagem: 'Secret Key do gateway não configurada.' };
  }
  return { sucesso: true, mensagem: 'Campos preenchidos corretamente. Teste real indisponível.' };
}

export async function testarApiSefaz(
  config: ConfigIntegracao
): Promise<{ sucesso: boolean; mensagem: string }> {
  if (!config.sefaz_ambiente) {
    return { sucesso: false, mensagem: 'Ambiente SEFAZ não configurado.' };
  }
  const ambiente = config.sefaz_ambiente === 'homologacao' ? 'homologação' : 'produção';
  return { sucesso: true, mensagem: `Campos preenchidos para ${ambiente}. Teste real via Edge Function.` };
}

export async function testarUrl(
  url: string
): Promise<{ sucesso: boolean; mensagem: string }> {
  if (!url || url.trim() === '') {
    return { sucesso: false, mensagem: 'URL não informada.' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
      clearTimeout(timeout);
      if (response.ok || (response.status >= 200 && response.status < 400)) {
        return { sucesso: true, mensagem: `URL acessível (status ${response.status}).` };
      }
      return { sucesso: false, mensagem: `URL retornou status ${response.status}.` };
    } catch (fetchErr: unknown) {
      clearTimeout(timeout);
      throw fetchErr;
    }
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        return { sucesso: false, mensagem: 'Tempo limite esgotado ao tentar conectar.' };
      }
      // CORS or network error — server may be reachable but browser policy blocks access
      if (err.message.toLowerCase().includes('failed to fetch') || err.message.toLowerCase().includes('cors')) {
        return { sucesso: false, mensagem: 'Não foi possível verificar a URL (CORS ou rede). Verifique manualmente.' };
      }
    }
    return { sucesso: false, mensagem: 'Não foi possível conectar à URL informada.' };
  }
}
