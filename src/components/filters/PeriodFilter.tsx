import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Period } from './periodTypes';

const periods: { value: Period; label: string }[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '15d', label: '15 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: 'year', label: 'Este ano' },
];

interface PeriodFilterProps {
  value: Period;
  onChange: (period: Period) => void;
  options?: { value: Period; label: string }[];
}

export function PeriodFilter({ value, onChange, options }: PeriodFilterProps) {
  const items = options || periods;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      {items.map((p) => (
        <Button
          key={p.value}
          variant={value === p.value ? 'default' : 'outline'}
          size="sm"
          onClick={() => onChange(p.value)}
          className={cn('h-8 text-xs', value !== p.value && 'text-muted-foreground')}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}
