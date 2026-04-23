/**
 * DiffViewer — visualização inteligente de mudanças para auditoria.
 *
 * Compreende três cenários:
 *  1. **INSERT**: anterior=null, novo=objeto → mostra "Criado" + lista de campos.
 *  2. **DELETE**: anterior=objeto, novo=null → mostra "Excluído" + lista de campos.
 *  3. **UPDATE**: ambos objetos → mostra apenas os campos alterados (path → antes → depois).
 *
 * Para a trilha `permission_audit`, o `payload` vem como `{ antes, depois }`
 * (já que a view envelopa `dados_anteriores`/`dados_novos`). Para
 * `permission_audit` puro, o `alteracao` jsonb pode ter qualquer formato — caímos
 * no fallback de pretty-print quando não conseguirmos extrair antes/depois.
 */

import { ViewSection, ViewField } from "@/components/ui/ViewField";
import { Badge } from "@/components/ui/badge";

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

function isPlainObject(v: unknown): v is Record<string, Json> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

/**
 * Extrai `{ antes, depois }` do payload da view, lidando com variações:
 *  - `auditoria_logs` ⇒ `{ antes: dados_anteriores, depois: dados_novos }`
 *  - `permission_audit` ⇒ `alteracao` pode já ter `antes/depois`, ou ser livre.
 */
export function extractAntesDepois(
  payload: unknown,
): { antes: Record<string, Json> | null; depois: Record<string, Json> | null; raw: unknown } {
  if (!isPlainObject(payload)) return { antes: null, depois: null, raw: payload };
  const antes = isPlainObject(payload.antes) ? (payload.antes as Record<string, Json>) : null;
  const depois = isPlainObject(payload.depois) ? (payload.depois as Record<string, Json>) : null;
  return { antes, depois, raw: payload };
}

interface DiffViewerProps {
  payload: unknown;
  /** Tipo de ação — usado para destacar INSERT/DELETE com banner. */
  acao?: string | null;
}

export function DiffViewer({ payload, acao }: DiffViewerProps) {
  const { antes, depois, raw } = extractAntesDepois(payload);

  // INSERT: só "depois"
  if (!antes && depois) {
    const keys = Object.keys(depois);
    return (
      <ViewSection title="Registro Criado">
        <Badge variant="outline" className="mb-2 border-success/40 text-success-foreground">
          + Criado
        </Badge>
        <div className="space-y-2">
          {keys.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem campos detalhados.</p>
          ) : (
            keys.map((k) => (
              <FieldRow key={k} label={k} value={depois[k]} tone="add" />
            ))
          )}
        </div>
      </ViewSection>
    );
  }

  // DELETE: só "antes"
  if (antes && !depois) {
    const keys = Object.keys(antes);
    return (
      <ViewSection title="Registro Excluído">
        <Badge variant="outline" className="mb-2 border-destructive/40 text-destructive">
          − Excluído
        </Badge>
        <div className="space-y-2">
          {keys.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem campos detalhados.</p>
          ) : (
            keys.map((k) => (
              <FieldRow key={k} label={k} value={antes[k]} tone="remove" />
            ))
          )}
        </div>
      </ViewSection>
    );
  }

  // UPDATE: ambos presentes — mostra só campos alterados.
  if (antes && depois) {
    const allKeys = Array.from(new Set([...Object.keys(antes), ...Object.keys(depois)]));
    const changed = allKeys.filter(
      (k) => JSON.stringify(antes[k]) !== JSON.stringify(depois[k]),
    );
    if (changed.length === 0) {
      return (
        <ViewSection title="Campos Alterados">
          <p className="text-xs text-muted-foreground">
            Nenhum campo alterado detectado no diff.
          </p>
        </ViewSection>
      );
    }
    return (
      <ViewSection title={`Campos Alterados (${changed.length})`}>
        <div className="space-y-2">
          {changed.map((key) => (
            <div key={key} className="rounded-md border bg-muted/30 p-2 text-xs">
              <span className="font-semibold text-muted-foreground uppercase tracking-wide">
                {key}
              </span>
              <div className="mt-1 flex flex-col gap-1">
                <div className="flex items-start gap-2">
                  <span className="shrink-0 rounded bg-destructive/15 text-destructive border border-destructive/30 px-1 py-0.5 font-mono text-[10px]">
                    antes
                  </span>
                  <span className="font-mono break-all whitespace-pre-wrap text-foreground/70">
                    {formatValue(antes[key])}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="shrink-0 rounded bg-success/15 text-success-foreground border border-success/30 px-1 py-0.5 font-mono text-[10px]">
                    depois
                  </span>
                  <span className="font-mono break-all whitespace-pre-wrap">
                    {formatValue(depois[key])}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ViewSection>
    );
  }

  // Fallback: payload livre (ex.: permission_audit.alteracao não-estruturado)
  if (raw == null) return null;
  return (
    <ViewSection title="Detalhes do Evento">
      {acao && (
        <Badge variant="outline" className="mb-2">
          {acao}
        </Badge>
      )}
      <ViewField label="Payload">
        <pre className="rounded-lg bg-muted/50 border p-3 text-xs font-mono overflow-x-auto max-h-64 whitespace-pre-wrap break-all">
          {formatValue(raw)}
        </pre>
      </ViewField>
    </ViewSection>
  );
}

function FieldRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: unknown;
  tone: "add" | "remove";
}) {
  const toneClass =
    tone === "add"
      ? "bg-success/10 border-success/30"
      : "bg-destructive/10 border-destructive/30";
  return (
    <div className={`rounded-md border ${toneClass} p-2 text-xs`}>
      <span className="font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <div className="mt-1 font-mono break-all whitespace-pre-wrap">
        {formatValue(value)}
      </div>
    </div>
  );
}
