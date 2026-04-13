export interface SlideLayoutBox { x: number; y: number; w: number; h: number }

export const defaultSlideLayout = {
  title: { x: 0.4, y: 0.3, w: 12, h: 0.8 },
  subtitle: { x: 0.4, y: 1.2, w: 12, h: 0.5 },
  kpi: { x: 0.4, y: 2, w: 5.8, h: 1.1 },
  chart: { x: 0.4, y: 3.1, w: 8.5, h: 3.6 },
  commentary: { x: 9.1, y: 3.1, w: 3.8, h: 3.6 },
};
