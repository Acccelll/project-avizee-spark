// Extrai texto de PDF usando pdfjs-dist (client-side).
// pdfjs-dist v5+ distribui apenas worker ESM. Usamos `?worker` do Vite e
// atribuímos via `workerPort` — usar `workerSrc` com URL do .mjs faz o
// pdfjs criar um Worker clássico, disparando "Setting up fake worker failed".
import * as pdfjsLib from "pdfjs-dist";
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker";

if (!pdfjsLib.GlobalWorkerOptions.workerPort) {
  pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();
}

export async function extractPdfText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  const chunks: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let last_y: number | null = null;
    const line: string[] = [];
    for (const it of content.items as Array<{ str: string; transform: number[] }>) {
      const y = it.transform[5];
      if (last_y !== null && Math.abs(y - last_y) > 2) {
        chunks.push(line.join(" "));
        line.length = 0;
      }
      line.push(it.str);
      last_y = y;
    }
    if (line.length) chunks.push(line.join(" "));
    chunks.push("\n---PAGE---\n");
  }
  return chunks.join("\n");
}