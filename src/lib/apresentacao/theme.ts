export interface ApresentacaoTheme {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    background: string;
    success: string;
    danger: string;
    neutral: string;
  };
  fonts: {
    body: string;
    heading: string;
  };
}

export const DEFAULT_THEME: ApresentacaoTheme = {
  colors: {
    primary: '1F4E79',
    secondary: '5B9BD5',
    accent: 'ED7D31',
    text: '404040',
    background: 'FFFFFF',
    success: '70AD47',
    danger: 'C00000',
    neutral: 'A5A5A5',
  },
  fonts: {
    body: 'Calibri',
    heading: 'Calibri Light',
  }
};

export function getTheme(config?: Record<string, any>): ApresentacaoTheme {
  if (!config || !config.theme) return DEFAULT_THEME;

  return {
    colors: {
      ...DEFAULT_THEME.colors,
      ...(config.theme.colors || {})
    },
    fonts: {
      ...DEFAULT_THEME.fonts,
      ...(config.theme.fonts || {})
    }
  };
}
