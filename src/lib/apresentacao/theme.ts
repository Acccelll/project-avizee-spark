export interface ApresentacaoTheme {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    warning: string;
    danger: string;
    text: string;
    muted: string;
    background: string;
    white: string;
  };
  typography: {
    fontFamily: string;
    titleSize: number;
    subtitleSize: number;
    bodySize: number;
    smallSize: number;
  };
}

export const apresentacaoTheme: ApresentacaoTheme = {
  colors: {
    primary: '0F2A57',
    secondary: '1E5EFF',
    accent: '11A683',
    warning: 'D97706',
    danger: 'DC2626',
    text: '111827',
    muted: '6B7280',
    background: 'F8FAFC',
    white: 'FFFFFF',
  },
  typography: {
    fontFamily: 'Calibri',
    titleSize: 30,
    subtitleSize: 16,
    bodySize: 14,
    smallSize: 11,
  },
};

export const apresentacaoThemeDark: ApresentacaoTheme = {
  colors: {
    primary: 'E2E8F0',
    secondary: '60A5FA',
    accent: '34D399',
    warning: 'F59E0B',
    danger: 'F87171',
    text: 'E5E7EB',
    muted: '94A3B8',
    background: '0F172A',
    white: '111827',
  },
  typography: apresentacaoTheme.typography,
};

export type ThemePreset = 'default' | 'dark';

export function resolveApresentacaoTheme(preset?: string | null): ApresentacaoTheme {
  if (preset === 'dark') return apresentacaoThemeDark;
  return apresentacaoTheme;
}
