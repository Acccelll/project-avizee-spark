/**
 * Utilitários de validação e força de senha para a aba "Segurança" das
 * Configurações pessoais. Centralizados aqui para que `useChangePassword`
 * e `SegurancaSection` compartilhem a mesma fonte de verdade.
 */

export interface PasswordCriterion {
  key: string;
  label: string;
  met: boolean;
}

export interface PasswordStrength {
  label: string;
  level: 0 | 1 | 2 | 3;
  bar: string;
}

export function getPasswordStrength(pwd: string): PasswordStrength {
  if (!pwd) return { label: '', level: 0, bar: '' };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 2) return { label: 'Fraca', level: 1, bar: 'bg-destructive' };
  if (score <= 3) return { label: 'Média', level: 2, bar: 'bg-warning' };
  return { label: 'Forte', level: 3, bar: 'bg-success' };
}

export function getPasswordCriteria(pwd: string, confirm: string): PasswordCriterion[] {
  return [
    { key: 'length', label: 'Pelo menos 8 caracteres', met: pwd.length >= 8 },
    { key: 'case', label: 'Letras maiúsculas e minúsculas', met: /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) },
    { key: 'digit', label: 'Pelo menos um número', met: /\d/.test(pwd) },
    { key: 'match', label: 'Confirmação confere', met: !!pwd && pwd === confirm },
  ];
}

export function getFontLabel(scale: number): string {
  if (scale <= 16) return 'Padrão';
  if (scale <= 18) return 'Médio';
  if (scale <= 20) return 'Grande';
  return 'Máximo';
}

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  vendedor: 'Vendedor',
  financeiro: 'Financeiro',
  estoquista: 'Estoquista',
};

export const APPEARANCE_DEFAULTS = {
  theme: 'system',
  densidade: 'confortavel',
  fontScale: 16,
  menuCompacto: true,
  reduceMotion: false,
  corPrimaria: '#6b0d0d',
  corSecundaria: '#b85b2d',
} as const;