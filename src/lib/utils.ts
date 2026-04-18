import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function downloadTextFile(filename: string, content: string, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

export function toSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Builds a sanitized export filename: `<slug-do-titulo>_<YYYY-MM-DD-HH-MM-SS>.<ext>`
 *
 * - removes accents/spaces from the title
 * - appends an ISO-like timestamp to avoid overwrites and ease sorting
 */
export function buildExportFilename(title: string, ext: string): string {
  const slug = toSlug(title) || "export";
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const cleanExt = ext.replace(/^\./, "");
  return `${slug}_${ts}.${cleanExt}`;
}
