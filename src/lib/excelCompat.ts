/**
 * Compatibility layer that exposes an xlsx-like API using exceljs under the hood.
 * This avoids the prototype-pollution vulnerabilities of the `xlsx` package.
 */
import ExcelJS from "exceljs";

export interface WorkSheet {
  [cell: string]: unknown;
  "!ref"?: string;
}

export interface WorkBook {
  SheetNames: string[];
  Sheets: Record<string, WorkSheet>;
  /** Internal reference to the ExcelJS workbook for advanced usage */
  _exceljs: ExcelJS.Workbook;
}

function worksheetToJson(ws: ExcelJS.Worksheet, opts?: { header?: 1 }): unknown[] {
  const rows: unknown[][] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      values[colNumber - 1] = cell.value;
    });
    rows.push(values);
  });

  if (rows.length === 0) return [];

  if (opts?.header === 1) {
    return rows;
  }

  // Use first row as header
  const headers = rows[0].map((h) => (h != null ? String(h) : ""));
  return rows.slice(1).map((row) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((header, i) => {
      if (header) obj[header] = row[i] ?? null;
    });
    return obj;
  });
}

function buildWorkSheetProxy(ws: ExcelJS.Worksheet): WorkSheet {
  const sheet: WorkSheet = {};
  sheet["!ref"] = ws.dimensions?.toString() ?? undefined;
  return sheet;
}

export async function read(data: ArrayBuffer | string | Uint8Array): Promise<WorkBook> {
  const wb = new ExcelJS.Workbook();

  if (typeof data === "string") {
    // binary string → ArrayBuffer
    const buf = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) buf[i] = data.charCodeAt(i) & 0xff;
    await wb.xlsx.load(buf.buffer as ArrayBuffer);
  } else if (data instanceof ArrayBuffer) {
    await wb.xlsx.load(data);
  } else {
    await wb.xlsx.load(data.buffer as ArrayBuffer);
  }

  const sheetNames = wb.worksheets.map((ws) => ws.name);
  const sheets: Record<string, WorkSheet> = {};
  wb.worksheets.forEach((ws) => {
    sheets[ws.name] = buildWorkSheetProxy(ws);
  });

  return { SheetNames: sheetNames, Sheets: sheets, _exceljs: wb };
}

export const utils = {
  sheet_to_json(sheetOrWb: WorkSheet | WorkBook, opts?: { header?: 1 }, sheetName?: string): unknown[] {
    // Support being called with (workbook.Sheets[name]) pattern
    // We need the actual ExcelJS worksheet, so we find it via the workbook
    // The caller should use the convenience wrapper below
    return [];
  },

  json_to_sheet(_data: Record<string, unknown>[]): WorkSheet {
    return {};
  },

  book_new(): WorkBook {
    return { SheetNames: [], Sheets: {}, _exceljs: new ExcelJS.Workbook() };
  },

  book_append_sheet(wb: WorkBook, _ws: WorkSheet, name: string): void {
    wb.SheetNames.push(name);
    wb.Sheets[name] = _ws;
  },
};

/**
 * Higher-level helper: read a File and return parsed sheet data.
 * Use this instead of the lower-level `read` + `utils.sheet_to_json` combo.
 */
export async function readFileSheets(file: File): Promise<{
  sheetNames: string[];
  getSheetData: (sheetName: string, opts?: { header?: 1 }) => unknown[];
  workbook: ExcelJS.Workbook;
}> {
  const buffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const sheetNames = wb.worksheets.map((ws) => ws.name);

  function getSheetData(sheetName: string, opts?: { header?: 1 }): unknown[] {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) return [];
    return worksheetToJson(ws, opts);
  }

  return { sheetNames, getSheetData, workbook: wb };
}

/**
 * Export data to xlsx and trigger download.
 */
export async function exportToXlsx(
  filename: string,
  sheetsData: Record<string, Record<string, unknown>[]>,
): Promise<void> {
  const wb = new ExcelJS.Workbook();

  Object.entries(sheetsData).forEach(([sheetName, rows]) => {
    const ws = wb.addWorksheet(sheetName);
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    ws.addRow(headers);
    rows.forEach((row) => ws.addRow(headers.map((h) => row[h])));
  });

  const buffer = await wb.xlsx.writeBuffer();
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

/**
 * Read an ExcelJS workbook and return sheet data in the xlsx-compatible format.
 * Used by import hooks that stored the workbook reference.
 */
export function getSheetDataFromWorkbook(
  wb: ExcelJS.Workbook,
  sheetName: string,
  opts?: { header?: 1 },
): unknown[] {
  const ws = wb.getWorksheet(sheetName);
  if (!ws) return [];
  return worksheetToJson(ws, opts);
}

export default { read, utils, readFileSheets, exportToXlsx, getSheetDataFromWorkbook };
