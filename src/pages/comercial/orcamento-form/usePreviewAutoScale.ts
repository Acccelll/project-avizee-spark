import { useEffect, useState, type RefObject } from "react";

/**
 * Calcula auto-fit (largura E altura) de um preview A4 dentro de um stage.
 * Recomputa em resize do container e quando o dialog abre/alterna fullscreen.
 * Mantém escala em [0.25, 1.5].
 */
export function usePreviewAutoScale(
  stageRef: RefObject<HTMLDivElement>,
  active: boolean,
  fullscreen: boolean,
) {
  const [autoScale, setAutoScale] = useState<number>(1);

  useEffect(() => {
    if (!active) return;
    const el = stageRef.current;
    if (!el) return;
    const A4_WIDTH_PX = 794;  // 210mm @ 96dpi
    const A4_HEIGHT_PX = 1123; // 297mm @ 96dpi
    const PAD = 32;
    const compute = () => {
      const w = Math.max(0, el.clientWidth - PAD);
      const h = Math.max(0, el.clientHeight - PAD);
      const s = Math.min(w / A4_WIDTH_PX, h / A4_HEIGHT_PX);
      if (Number.isFinite(s) && s > 0) {
        setAutoScale(Math.min(1.5, Math.max(0.25, s)));
      }
    };
    const t = window.setTimeout(compute, 50);
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => {
      window.clearTimeout(t);
      ro.disconnect();
    };
  }, [active, fullscreen, stageRef]);

  return autoScale;
}