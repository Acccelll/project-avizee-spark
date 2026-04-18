import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * useUrlListState — padroniza serialização de filtros de listagem em URL params.
 *
 * Uso:
 *   const { value, set, clear } = useUrlListState({
 *     schema: {
 *       q:        { type: "string" },
 *       status:   { type: "stringArray" },
 *       cliente:  { type: "stringArray" },
 *       de:       { type: "string" },
 *       ate:      { type: "string" },
 *     },
 *   });
 *
 *   value.q          // string
 *   value.status     // string[]
 *   set({ status: ["novo","aprovado"] })
 *   clear()                       // limpa todos os campos do schema
 *   clear(["status","cliente"])   // limpa só estes
 *
 * Notas:
 *  - Arrays são serializados como CSV (`status=novo,aprovado`) — legível e curto.
 *  - Aliases legados (ex.: `data_inicio` → `dataInicio`) podem ser informados
 *    em `aliases` para manter compatibilidade durante migrações.
 *  - Não toca em params fora do `schema` (ex.: `tab`, `id`).
 */

type FieldType = "string" | "stringArray" | "number";

export interface FieldSchema {
  type: FieldType;
  /** Outros nomes aceitos na leitura (compatibilidade retroativa). */
  aliases?: string[];
}

export type Schema = Record<string, FieldSchema>;

type ValueOf<T extends FieldSchema> = T["type"] extends "stringArray"
  ? string[]
  : T["type"] extends "number"
    ? number | undefined
    : string;

export type SchemaValues<S extends Schema> = { [K in keyof S]: ValueOf<S[K]> };

function readField(params: URLSearchParams, key: string, field: FieldSchema): unknown {
  const sources = [key, ...(field.aliases ?? [])];
  let raw: string | null = null;
  for (const src of sources) {
    const v = params.get(src);
    if (v != null && v !== "") {
      raw = v;
      break;
    }
  }
  if (field.type === "stringArray") {
    if (!raw) return [];
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (field.type === "number") {
    if (!raw) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }
  return raw ?? "";
}

function writeField(params: URLSearchParams, key: string, field: FieldSchema, value: unknown) {
  // Always strip aliases on write so we converge to the canonical key.
  for (const alias of field.aliases ?? []) params.delete(alias);

  if (field.type === "stringArray") {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    if (arr.length === 0) params.delete(key);
    else params.set(key, arr.join(","));
    return;
  }
  if (field.type === "number") {
    if (value == null || value === "" || !Number.isFinite(Number(value))) {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }
    return;
  }
  const s = (value as string | undefined)?.toString() ?? "";
  if (!s) params.delete(key);
  else params.set(key, s);
}

export function useUrlListState<S extends Schema>(opts: { schema: S }) {
  const { schema } = opts;
  const [searchParams, setSearchParams] = useSearchParams();

  const value = useMemo(() => {
    const out: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(schema)) {
      out[key] = readField(searchParams, key, field);
    }
    return out as SchemaValues<S>;
  }, [searchParams, schema]);

  const set = useCallback(
    (patch: Partial<SchemaValues<S>>) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, val] of Object.entries(patch)) {
        const field = schema[key];
        if (!field) continue;
        writeField(next, key, field, val);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams, schema],
  );

  const clear = useCallback(
    (keys?: Array<keyof S>) => {
      const next = new URLSearchParams(searchParams);
      const target = keys ?? (Object.keys(schema) as Array<keyof S>);
      for (const key of target) {
        const field = schema[key as string];
        if (!field) continue;
        next.delete(key as string);
        for (const alias of field.aliases ?? []) next.delete(alias);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams, schema],
  );

  return { value, set, clear };
}
