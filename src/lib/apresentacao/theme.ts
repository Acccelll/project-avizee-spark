/**
 * AviZee Presentation Theme
 * Central palette, font sizes, and layout constants for generated slides.
 */

export const THEME = {
  colors: {
    primary: '1F3864',       // Dark navy (AviZee primary)
    secondary: '2E75B6',     // Mid blue
    accent: 'ED7D31',        // Orange accent
    success: '70AD47',       // Green
    danger: 'FF0000',        // Red
    warning: 'FFC000',       // Yellow/amber
    white: 'FFFFFF',
    lightGray: 'F2F2F2',
    darkGray: '404040',
    mediumGray: '808080',
    background: 'F7F9FC',
    chartSeries: [
      '2E75B6', 'ED7D31', '70AD47', 'FFC000',
      '9E2A2B', '5A3E6B', '1F7A8C', 'B87333',
    ],
  },
  fonts: {
    title: 'Calibri',
    body: 'Calibri',
    mono: 'Courier New',
  },
  fontSizes: {
    coverTitle: 36,
    coverSubtitle: 18,
    slideTitle: 24,
    slideSubtitle: 14,
    kpiValue: 28,
    kpiLabel: 10,
    body: 11,
    caption: 9,
    comment: 10,
    tableHeader: 10,
    tableBody: 9,
  },
  slide: {
    widthInches: 13.33,
    heightInches: 7.5,
  },
} as const;

export type ThemeColor = keyof typeof THEME.colors;
