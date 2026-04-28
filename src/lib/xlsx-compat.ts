/**
 * Drop-in replacement for the `xlsx` package using `exceljs` under the hood.
 * Eliminates the prototype-pollution vulnerability in xlsx@0.18.5.
 *
 * Only the subset of the API actually used in this codebase is implemented.
 *
 * NOTE: ExcelJS is imported dynamically to keep the ~400KB library out of the
 * initial bundle. The first call to `read()` / `utils.book_new()` triggers
 * the import; subsequent calls reuse the cached module.
 */
import type ExcelJSNs from "exceljs";

type ExcelJSModule = typeof ExcelJSNs;
let excelJsPromise: Promise<ExcelJSModule> | null = null;

async function loadExcelJS(): Promise<ExcelJSModule> {
  if (!excelJsPromise) {
    excelJsPromise = import("exceljs").then((m) => (m.default ?? m) as ExcelJSModule);
  }
  return excelJsPromise;
}

/* ---------- Internal helpers ---------- */

function worksheetToRows(ws: ExcelJSNs.Worksheet): unknown[][] {
  const rows: unknown[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const values: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      values[colNumber - 1] = cell.value;
    });
    rows.push(values);
  });
  return rows;
}

/* ---------- Public types ---------- */

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface WorkSheet {
  /** @internal */
  _ws: ExcelJSNs.Worksheet;
}

export interface WorkBook {
  SheetNames: string[];
  Sheets: Record<string, WorkSheet>;
  /** @internal */
  _wb: ExcelJSNs.Workbook;
}

/* ---------- read ---------- */

export function read(data: unknown, _opts?: { type?: string }): WorkBook {
  // ExcelJS's xlsx.load is async – we wrap it with a sync-looking API that
  // stores a promise. The sheet data (and the ExcelJS module itself) are
  // resolved lazily via _loaded; consumers MUST call `await ensureLoaded(wb)`
  // before touching SheetNames / Sheets.
  const result: WorkBook = {
    SheetNames: [],
    Sheets: {},
    // Real workbook is assigned during _loaded; cast keeps the public type stable.
    _wb: undefined as unknown as ExcelJSNs.Workbook,
  };

  // We store a promise so consumers can await it before using data
  (result as WorkBook & { _loaded: Promise<void> })._loaded = (async () => {
    const ExcelJS = await loadExcelJS();
    const wb = new ExcelJS.Workbook();
    result._wb = wb;
    let buffer: ArrayBuffer;
    if (typeof data === "string") {
      const buf = new Uint8Array(data.length);
      for (let i = 0; i < data.length; i++) buf[i] = data.charCodeAt(i) & 0xff;
      buffer = buf.buffer as ArrayBuffer;
    } else if (data instanceof ArrayBuffer) {
      buffer = data;
    } else if (ArrayBuffer.isView(data)) {
      buffer = (data as Uint8Array).buffer as ArrayBuffer;
    } else {
      buffer = data as ArrayBuffer;
    }
    await wb.xlsx.load(buffer);
    const worksheets = wb.worksheets || [];
    result.SheetNames = worksheets.map((ws) => ws.name);
    worksheets.forEach((ws) => {
      result.Sheets[ws.name] = { _ws: ws };
    });
  })();

  return result;
}

/** Ensure workbook is loaded (call once before accessing sheets). */
export async function ensureLoaded(wb: WorkBook): Promise<void> {
  await (wb as WorkBook & { _loaded: Promise<void> })._loaded;
}

/* ---------- utils ---------- */

export const utils = {
  sheet_to_json(sheet: WorkSheet, opts?: { header?: 1 }): unknown[] {
    const rows = worksheetToRows(sheet._ws);
    if (rows.length === 0) return [];

    if (opts?.header === 1) return rows;

    const headers = rows[0].map((h) => (h != null ? String(h) : ""));
    return rows.slice(1).map((row) => {
      const obj: Record<string, unknown> = {};
      headers.forEach((header, i) => {
        if (header) obj[header] = row[i] ?? null;
      });
      return obj;
    });
  },

  async json_to_sheet(data: Record<string, unknown>[]): Promise<WorkSheet> {
    const ExcelJS = await loadExcelJS();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sheet1");
    if (data.length > 0) {
      const headers = Object.keys(data[0]);
      ws.addRow(headers);
      data.forEach((row) => ws.addRow(headers.map((h) => row[h])));
    }
    return { _ws: ws };
  },

  async book_new(): Promise<WorkBook> {
    const ExcelJS = await loadExcelJS();
    return { SheetNames: [], Sheets: {}, _wb: new ExcelJS.Workbook() };
  },

  book_append_sheet(wb: WorkBook, ws: WorkSheet, name: string): void {
    // Copy the worksheet into the workbook
    const targetWs = wb._wb.addWorksheet(name);
    ws._ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const targetRow = targetWs.getRow(rowNumber);
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        targetRow.getCell(colNumber).value = cell.value;
      });
      targetRow.commit();
    });
    wb.SheetNames.push(name);
    wb.Sheets[name] = { _ws: targetWs };
  },
};

/* ---------- writeFile ---------- */

export async function writeFile(wb: WorkBook, filename: string): Promise<void> {
  const buffer = await wb._wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default { read, ensureLoaded, utils, writeFile };
