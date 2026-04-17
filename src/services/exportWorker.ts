/**
 * Web Worker for generating CSV exports off the main thread.
 * Handles datasets of any size without blocking the UI.
 *
 * Accepted message format:
 *   { type: 'generate-csv', id: string, payload: { rows: Record<string, unknown>[], columns: { key: string; label: string }[] } }
 *
 * Posted response format (on success):
 *   { type: 'csv-done', id: string, csv: string }
 *
 * Posted response format (on error):
 *   { type: 'csv-error', id: string, message: string }
 */

const escapeCSV = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  const s = String(value);
  if (s.includes(';') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

self.onmessage = (e: MessageEvent) => {
  const { type, id, payload } = e.data as {
    type: string;
    id: string;
    payload: { rows: Record<string, unknown>[]; columns: { key: string; label: string }[] };
  };

  if (type !== 'generate-csv') return;

  try {
    const { rows, columns } = payload;
    const header = columns.map((c) => escapeCSV(c.label)).join(';');
    const body = rows
      .map((row) => columns.map((c) => escapeCSV(row[c.key])).join(';'))
      .join('\n');
    const csv = `${header}\n${body}`;
    self.postMessage({ type: 'csv-done', id, csv });
  } catch (err) {
    self.postMessage({ type: 'csv-error', id, message: String(err) });
  }
};
