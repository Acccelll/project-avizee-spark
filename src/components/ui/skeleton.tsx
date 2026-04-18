import { cn } from "@/lib/utils";

export type SkeletonTone = "default" | "card";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Tom do skeleton. Use `card` quando renderizado sobre `bg-card` para
   * garantir contraste visível (default `bg-muted` quase desaparece em cards).
   */
  tone?: SkeletonTone;
}

const toneClass: Record<SkeletonTone, string> = {
  default: "bg-muted",
  card: "bg-muted-foreground/10",
};

function Skeleton({ className, tone = "default", ...props }: SkeletonProps) {
  return (
    <div className={cn("animate-pulse rounded-md", toneClass[tone], className)} {...props} />
  );
}

export { Skeleton };
