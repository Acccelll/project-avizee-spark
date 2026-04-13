export function formatCurrency(value: number | null | undefined): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value ?? 0));
}

export function formatPercent(value: number | null | undefined): string {
  return `${Number(value ?? 0).toFixed(1)}%`;
}

export function hashPayload(payload: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload)))).slice(0, 48);
}

export function monthLabel(competencia: string): string {
  const [y, m] = competencia.slice(0, 7).split('-');
  return `${m}/${y}`;
}

export function pickEditedComment(automatico: string, editado?: string | null): string {
  return editado?.trim() ? editado : automatico;
}

export function calculateVariation(current: number, previous: number): number {
  if (!previous) return 0;
  return ((current - previous) / previous) * 100;
}
