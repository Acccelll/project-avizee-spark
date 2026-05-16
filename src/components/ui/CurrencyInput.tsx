import { forwardRef, useCallback, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: number;
  onChange: (value: number) => void;
  currency?: string;
  locale?: string;
}

/**
 * Campo de valor monetário com formatação `Intl.NumberFormat` no blur e
 * edição numérica no focus. Mantém uma única fonte de verdade (number).
 */
export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, currency = 'BRL', locale = 'pt-BR', className, ...props }, ref) => {
    const [focused, setFocused] = useState(false);

    const formatCurrency = (num: number) =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
      }).format(num);

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/[^\d.,-]/g, '').replace(',', '.');
        const parsed = parseFloat(raw);
        onChange(isNaN(parsed) ? 0 : parsed);
      },
      [onChange],
    );

    return (
      <Input
        ref={ref}
        type={focused ? 'number' : 'text'}
        inputMode="decimal"
        step="0.01"
        min="0"
        value={focused ? (value || '') : (value > 0 ? formatCurrency(value) : '')}
        onChange={focused ? handleChange : undefined}
        onFocus={(e) => {
          setFocused(true);
          const el = e.target;
          setTimeout(() => {
            try { el.setSelectionRange(el.value.length, el.value.length); } catch { /* noop */ }
          }, 0);
        }}
        onBlur={() => setFocused(false)}
        placeholder="R$ 0,00"
        className={cn(focused ? 'font-mono' : '', className)}
        {...props}
      />
    );
  },
);
CurrencyInput.displayName = 'CurrencyInput';