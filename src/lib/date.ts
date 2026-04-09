export function toLocalDateInput(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function getDefaultDateRange(days = 30): { inicio: string; fim: string } {
  const fimDate = new Date();
  const inicioDate = new Date(fimDate.getFullYear(), fimDate.getMonth(), fimDate.getDate() - days);
  return {
    inicio: toLocalDateInput(inicioDate),
    fim: toLocalDateInput(fimDate),
  };
}
