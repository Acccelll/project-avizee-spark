export function formatMoneyCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} mi`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)} mil`;
  return value.toFixed(2);
}

export function formatPercentOne(value: number): string {
  return `${value.toFixed(1)}%`;
}
