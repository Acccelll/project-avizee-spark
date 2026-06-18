import { notifyError } from "@/utils/errorMessages";
import { toast } from "sonner";

/** Aguarda as fontes Montserrat ficarem prontas antes de renderizar o canvas. */
export async function ensurePdfFontsReady() {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await Promise.all([
      document.fonts.load("400 16px Montserrat"),
      document.fonts.load("500 16px Montserrat"),
      document.fonts.load("600 16px Montserrat"),
      document.fonts.load("700 16px Montserrat"),
      document.fonts.load("800 16px Montserrat"),
      document.fonts.ready,
    ]);
  } catch {
    // Não bloqueia a exportação se a API de fontes falhar.
  }
}

function sanitizeClienteName(nome: string | undefined | null): string {
  return (nome || "CLIENTE")
    .toUpperCase()
    .replace(/[\\/:*?"<>|]/g, "")
    .trim();
}

async function renderNodeToPdf(node: HTMLElement) {
  await ensurePdfFontsReady();
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  const canvas = await html2canvas(node, { scale: 2, useCORS: true, backgroundColor: "#fff" });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "mm", "a4");
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
  pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
  return pdf;
}

/** Captura o template off-screen e dispara o download do PDF do orçamento. */
export function generateOrcamentoPdf(params: {
  node: HTMLElement | null;
  numero: string;
  clienteNome: string;
}) {
  const { node, numero, clienteNome } = params;
  const capture = async () => {
    if (!node) return;
    try {
      const pdf = await renderNodeToPdf(node);
      const safeCliente = sanitizeClienteName(clienteNome);
      pdf.save(`${numero || "ORCAMENTO"} - ${safeCliente}.pdf`);
      toast.success("PDF gerado com sucesso!");
    } catch (err: unknown) {
      notifyError(err);
    }
  };
  requestAnimationFrame(() => requestAnimationFrame(() => { capture(); }));
}

/** Versão Blob — usada para anexar em e-mail (sem download). */
export function buildOrcamentoPdfBlob(node: HTMLElement | null): Promise<Blob | null> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(async () => {
      try {
        if (!node) return resolve(null);
        const pdf = await renderNodeToPdf(node);
        resolve(pdf.output("blob"));
      } catch {
        resolve(null);
      }
    }));
  });
}