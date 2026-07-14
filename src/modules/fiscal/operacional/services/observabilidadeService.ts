/**
 * Observabilidade: coletor leve de métricas, tracing simplificado e correlação.
 * Adapters externos (OpenTelemetry, Datadog, etc.) podem consumir estes eventos.
 */

export type MetricKind = 'counter' | 'gauge' | 'histogram';

export interface MetricPoint {
  name: string;
  kind: MetricKind;
  value: number;
  labels?: Record<string, string>;
  timestamp: string;
}

export interface Span {
  id: string;
  traceId: string;
  parentId?: string;
  name: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  attributes?: Record<string, unknown>;
  status: 'ok' | 'erro';
}

export class ObservabilidadeService {
  private metrics: MetricPoint[] = [];
  private spans = new Map<string, Span>();

  record(name: string, kind: MetricKind, value: number, labels?: Record<string, string>): void {
    this.metrics.push({ name, kind, value, labels, timestamp: new Date().toISOString() });
  }

  incr(name: string, labels?: Record<string, string>): void {
    this.record(name, 'counter', 1, labels);
  }

  startSpan(name: string, traceId?: string, parentId?: string): Span {
    const id = crypto.randomUUID();
    const span: Span = {
      id,
      traceId: traceId ?? crypto.randomUUID(),
      parentId,
      name,
      startedAt: new Date().toISOString(),
      status: 'ok',
    };
    this.spans.set(id, span);
    return span;
  }

  endSpan(span: Span, status: 'ok' | 'erro' = 'ok'): Span {
    const endedAt = new Date();
    span.endedAt = endedAt.toISOString();
    span.durationMs = endedAt.getTime() - new Date(span.startedAt).getTime();
    span.status = status;
    return span;
  }

  snapshot(): { metrics: MetricPoint[]; spans: Span[] } {
    return { metrics: [...this.metrics], spans: [...this.spans.values()] };
  }

  reset(): void {
    this.metrics = [];
    this.spans.clear();
  }
}
