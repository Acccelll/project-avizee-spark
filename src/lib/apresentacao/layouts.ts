export interface SlideLayoutBox { x: number; y: number; w: number; h: number }

export const defaultSlideLayout = {
  canvas: { x: 0, y: 0, w: 13.33, h: 7.5 },
  headerBand: { x: 0, y: 0, w: 13.33, h: 0.85 },
  title: { x: 0.4, y: 0.3, w: 12, h: 0.8 },
  subtitle: { x: 0.4, y: 1.2, w: 12, h: 0.5 },
  content: { x: 0.4, y: 1.9, w: 8.6, h: 4.95 },
  kpi: { x: 0.4, y: 2, w: 5.8, h: 1.1 },
  chart: { x: 0.4, y: 1.9, w: 8.6, h: 4.95 },
  commentary: { x: 9.15, y: 1.9, w: 3.75, h: 4.95 },
  footer: { x: 0.5, y: 7.05, w: 12.2, h: 0.24 },
  unavailable: { x: 0.9, y: 2.45, w: 7.6, h: 2.8 },
};
