export interface ConfigGeral {
  nome_sistema: string;
  moeda: string;
  fuso_horario: string;
  formato_data: string;
  idioma: string;
  manutencao_modo: boolean;
}

export interface ConfigEmail {
  smtp_host: string;
  smtp_porta: number;
  smtp_usuario: string;
  smtp_senha: string;
  smtp_ssl: boolean;
  remetente_nome: string;
  remetente_email: string;
  template_assunto?: string;
  template_corpo?: string;
}

export interface ConfigIntegracao {
  gateway_pagamento: string;
  gateway_api_key: string;
  gateway_secret_key: string;
  sefaz_ambiente: 'producao' | 'homologacao';
  sefaz_certificado: string;
  sefaz_senha_certificado: string;
  webhook_url?: string;
  api_endpoint?: string;
}

export interface ConfigNotificacoes {
  email_novo_pedido: boolean;
  email_pagamento_recebido: boolean;
  email_estoque_baixo: boolean;
  push_ativo: boolean;
  frequencia_resumo: 'diario' | 'semanal' | 'nunca';
}

export interface ConfigBackup {
  frequencia: 'diario' | 'semanal' | 'mensal';
  horario: string;
  retencao_dias: number;
  incluir_arquivos: boolean;
  destino: 'local' | 'cloud';
}

export function mergeConfiguracoes<T>(
  defaultConfig: T,
  savedConfig: Partial<T> | null | undefined
): T {
  if (!savedConfig) return { ...defaultConfig };
  const result = { ...defaultConfig } as Record<string, unknown>;
  for (const key of Object.keys(savedConfig) as (keyof T)[]) {
    const value = ( savedConfig as Record<string, unknown>)[key as string];
    if (value !== undefined && value !== null) {
      result[key] = value;
    }
  }
  return result as T;
}

export function validarEmailConfig(config: ConfigEmail): { valido: boolean; erros: string[] } {
  const erros: string[] = [];

  if (!config.smtp_host || config.smtp_host.trim() === '') {
    erros.push('Servidor SMTP é obrigatório.');
  }

  if (
    !config.smtp_porta ||
    !Number.isInteger(config.smtp_porta) ||
    config.smtp_porta < 1 ||
    config.smtp_porta > 65535
  ) {
    erros.push('Porta SMTP inválida (deve ser entre 1 e 65535).');
  }

  if (config.remetente_email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(config.remetente_email)) {
      erros.push('E-mail do remetente inválido.');
    }
  }

  return { valido: erros.length === 0, erros };
}

export function formatarConfigParaAPI(
  config: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(config).filter(([, value]) => value !== undefined && value !== null)
  );
}
