import { useCallback, useRef, useState } from "react";

/**
 * Comparação rasa por chave + deep para arrays/objetos simples.
 * Suficiente para formulários de cadastro (sem Date/Map/Set).
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const ak = Object.keys(ao);
  const bk = Object.keys(bo);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!Object.prototype.hasOwnProperty.call(bo, k)) return false;
    if (!deepEqual(ao[k], bo[k])) return false;
  }
  return true;
}

export interface UseEditDirtyFormApi<T> {
  form: T;
  setForm: (next: T) => void;
  /** Aplica patch parcial preservando os demais campos. */
  updateForm: (patch: Partial<T>) => void;
  /** Reseta form e baseline para `next`. Use ao abrir create/edit. */
  reset: (next: T) => void;
  /** Marca o form atual como "salvo" (atualiza baseline mantendo valores). */
  markPristine: () => void;
  isDirty: boolean;
}

/**
 * Hook utilitário para formulários de cadastro.
 *
 * Mantém um baseline (snapshot do estado "limpo") e calcula `isDirty`
 * comparando o form atual contra esse baseline.
 *
 * Uso típico:
 * ```ts
 * const { form, updateForm, isDirty, reset, markPristine } = useEditDirtyForm(emptyForm);
 *
 * function openEdit(record) { reset({ ...mapRecordToForm(record) }); }
 * function openCreate()    { reset(emptyForm); }
 *
 * // ao confirmar fechar:
 * if (isDirty && !(await confirm())) return;
 *
 * // após salvar com sucesso:
 * markPristine();
 * ```
 */
export function useEditDirtyForm<T>(initial: T): UseEditDirtyFormApi<T> {
  const [form, setFormState] = useState<T>(initial);
  const baselineRef = useRef<T>(initial);
  const [, force] = useState(0);

  const setForm = useCallback((next: T) => {
    setFormState(next);
  }, []);

  const updateForm = useCallback((patch: Partial<T>) => {
    setFormState((prev) => ({ ...(prev as object), ...(patch as object) } as T));
  }, []);

  const reset = useCallback((next: T) => {
    baselineRef.current = next;
    setFormState(next);
    force((n) => n + 1);
  }, []);

  const markPristine = useCallback(() => {
    baselineRef.current = form;
    force((n) => n + 1);
  }, [form]);

  const isDirty = !deepEqual(form, baselineRef.current);

  return { form, setForm, updateForm, reset, markPristine, isDirty };
}
