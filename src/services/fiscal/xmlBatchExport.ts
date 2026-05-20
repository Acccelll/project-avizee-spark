/**
 * Export em lote de XMLs arquivados como arquivo .zip.
 *
 * - Lê os caminhos do bucket `dbavizee` via `downloadNfeXml` (signed downloads internos).
 * - Concorrência controlada (default 6) para não saturar a rede.
 * - Falhas individuais não abortam o lote — vão para `_falhas.txt`.
 * - Estrutura interna:
 *     xmls_nfe_{YYYYMMDD}_{YYYYMMDD}/
 *       entrada/{AAAA-MM}/{chave}.xml
 *       saida/{AAAA-MM}/{chave}.xml
 *       _resumo.csv
 *       _falhas.txt (opcional)
 */
import JSZip from "jszip";
import { downloadNfeXml } from "@/services/fiscal/xmlStorage.service";
import type { XmlArquivadoRow } from "@/types/relatorios-xml";

export interface XmlBatchExportProgress {
  phase: "coletando" | "compactando" | "finalizando";
  current: number;
  total: number;
}

export interface XmlBatchExportResult {
  arquivos: number;
  falhas: number;
  semCaminho: number;
  filename: string;
}

function safeDateRange(dataInicio?: string, dataFim?: string): string {
  const fmt = (s?: string) => (s ? s.replaceAll("-", "") : "todos");
  return `${fmt(dataInicio)}_${fmt(dataFim)}`;
}

function monthFolder(emissao: string | null): string {
  if (!emissao) return "sem-data";
  const d = new Date(emissao);
  if (isNaN(d.getTime())) return "sem-data";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function csvEscape(v: string | number): string {
  const s = String(v ?? "");
  if (/[",\n;]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

async function runPool<T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  concurrency = 6,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

export async function exportarXmlsZip(opts: {
  rows: XmlArquivadoRow[];
  dataInicio?: string;
  dataFim?: string;
  onProgress?: (p: XmlBatchExportProgress) => void;
  concurrency?: number;
}): Promise<XmlBatchExportResult> {
  const { rows, dataInicio, dataFim, onProgress, concurrency = 6 } = opts;

  const comCaminho = rows.filter((r): r is XmlArquivadoRow & { caminhoXml: string } => !!r.caminhoXml);
  const semCaminho = rows.length - comCaminho.length;

  if (comCaminho.length === 0) {
    throw new Error("Nenhuma das linhas filtradas possui XML arquivado.");
  }

  const zip = new JSZip();
  const rootFolderName = `xmls_nfe_${safeDateRange(dataInicio, dataFim)}`;
  const root = zip.folder(rootFolderName)!;

  const falhas: string[] = [];
  let done = 0;
  onProgress?.({ phase: "coletando", current: 0, total: comCaminho.length });

  await runPool(
    comCaminho,
    async (row) => {
      try {
        const blob = await downloadNfeXml(row.caminhoXml);
        const arr = await blob.arrayBuffer();
        const tipoDir = row.tipo === "entrada" ? "entrada" : "saida";
        const month = monthFolder(row.emissao);
        const safeName = `${(row.chave || row.notaFiscalId).replace(/[^A-Za-z0-9_-]/g, "")}.xml`;
        root.folder(tipoDir)!.folder(month)!.file(safeName, arr);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        falhas.push(`${row.tipo}\t${row.chave}\t${row.parceiro}\t${msg}`);
      } finally {
        done++;
        onProgress?.({ phase: "coletando", current: done, total: comCaminho.length });
      }
    },
    concurrency,
  );

  // _resumo.csv
  const header = ["tipo", "emissao", "numero", "serie", "chave", "parceiro", "valor", "status", "caminho_xml"]
    .map(csvEscape)
    .join(";");
  const lines = comCaminho.map((r) =>
    [r.tipo, r.emissao ?? "", r.numero, r.serie, r.chave, r.parceiro, r.valor, r.status, r.caminhoXml]
      .map(csvEscape)
      .join(";"),
  );
  root.file("_resumo.csv", [header, ...lines].join("\n"));

  if (falhas.length) {
    root.file(
      "_falhas.txt",
      ["tipo\tchave\tparceiro\terro", ...falhas].join("\n"),
    );
  }

  onProgress?.({ phase: "compactando", current: comCaminho.length, total: comCaminho.length });
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });

  const filename = `${rootFolderName}.zip`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);

  onProgress?.({ phase: "finalizando", current: comCaminho.length, total: comCaminho.length });

  return {
    arquivos: comCaminho.length - falhas.length,
    falhas: falhas.length,
    semCaminho,
    filename,
  };
}