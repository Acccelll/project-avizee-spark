export type Period = '7d' | '15d' | '30d' | '90d' | 'year' | 'hoje' | 'vencidos' | 'todos';

export const financialPeriods: { value: Period; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'hoje', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '15d', label: '15 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
];
