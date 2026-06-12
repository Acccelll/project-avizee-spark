import loaderAsset from "@/assets/avizee-loader.gif.asset.json";
import { cn } from "@/lib/utils";

export type BrandLoaderSize = "sm" | "md" | "lg";

const SIZE_MAP: Record<BrandLoaderSize, string> = {
  sm: "h-8",
  md: "h-14",
  lg: "h-20",
};

export interface BrandLoaderProps {
  size?: BrandLoaderSize;
  /** Accessible label for screen readers. Default: "Carregando". */
  label?: string;
  className?: string;
}

/**
 * Loader animado da marca AviZee — GIF transparente servido via CDN.
 * Substitui o `Spinner` em telas de carregamento (LazyPage, AuthLoadingScreen).
 */
export function BrandLoader({ size = "md", label = "Carregando", className }: BrandLoaderProps) {
  return (
    <div role="status" aria-label={label} className={cn("inline-flex items-center justify-center", className)}>
      <img
        src={loaderAsset.url}
        alt=""
        aria-hidden="true"
        draggable={false}
        className={cn("w-auto select-none drop-shadow-sm", SIZE_MAP[size])}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}