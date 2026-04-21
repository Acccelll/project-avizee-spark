import { useCallback, useEffect, useState } from 'react';

/**
 * useSafeDateInput — protege inputs `<input type="date">` de propagar valores
 * parciais a cada keystroke. Mantém estado local enquanto o usuário digita e
 * só publica para o estado externo quando:
 *  - o valor está vazio (limpar), ou
 *  - o valor é uma string ISO completa (`yyyy-mm-dd`), ou
 *  - o input perde o foco (`onBlur`).
 */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidISODate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const d = new Date(value + 'T00:00:00');
  return !Number.isNaN(d.getTime());
}

export function useSafeDateInput(externalValue: string, onCommit: (v: string) => void) {
  const [local, setLocal] = useState(externalValue ?? '');

  useEffect(() => {
    setLocal(externalValue ?? '');
  }, [externalValue]);

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocal(v);
    if (v === '' || isValidISODate(v)) {
      onCommit(v);
    }
  }, [onCommit]);

  const onBlur = useCallback(() => {
    if (local === '' || isValidISODate(local)) {
      onCommit(local);
    } else {
      setLocal(externalValue ?? '');
    }
  }, [local, externalValue, onCommit]);

  return { value: local, onChange, onBlur, invalid: local !== '' && !isValidISODate(local) };
}