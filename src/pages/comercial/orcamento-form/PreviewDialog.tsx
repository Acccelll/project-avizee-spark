import { forwardRef, type RefObject } from "react";
import { FileText, Maximize2, Minimize2, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { OrcamentoPdfTemplate } from "@/components/Orcamento/OrcamentoPdfTemplate";
import { OrcamentoPdfTemplateBrand } from "@/components/Orcamento/OrcamentoPdfTemplateBrand";
import type { OrcamentoItem } from "@/components/Orcamento/OrcamentoItemsGrid";
import type { ClienteSnapshot } from "./types";

export type LayoutTemplate = "classico" | "marca";

/** Conjunto de dados necessário para renderizar o template PDF do orçamento. */
export interface OrcamentoPdfData {
  numero: string;
  dataOrcamento: string;
  clienteSnapshot: ClienteSnapshot;
  items: OrcamentoItem[];
  totalProdutos: number;
  desconto: number;
  impostoSt: number;
  impostoIpi: number;
  freteValor: number;
  outrasDespesas: number;
  valorTotal: number;
  quantidadeTotal: number;
  pesoTotal: number;
  pagamento: string;
  prazoPagamento: string;
  prazoEntrega: string;
  freteTipo: string;
  servicoFrete: string;
  modalidade: string;
  observacoes: string;
  empresaConfig: Record<string, string> | null;
}

/** Renderiza um dos dois templates PDF (marca/clássico) com os mesmos dados. */
function OrcamentoPdfRender({ data, layout }: { data: OrcamentoPdfData; layout: LayoutTemplate }) {
  const Template = layout === "marca" ? OrcamentoPdfTemplateBrand : OrcamentoPdfTemplate;
  return (
    <Template
      numero={data.numero}
      data={data.dataOrcamento}
      cliente={data.clienteSnapshot}
      items={data.items.filter((i) => i.produto_id)}
      totalProdutos={data.totalProdutos}
      desconto={data.desconto}
      impostoSt={data.impostoSt}
      impostoIpi={data.impostoIpi}
      freteValor={data.freteValor}
      outrasDespesas={data.outrasDespesas}
      valorTotal={data.valorTotal}
      quantidadeTotal={data.quantidadeTotal}
      pesoTotal={data.pesoTotal}
      pagamento={data.pagamento}
      prazoPagamento={data.prazoPagamento}
      prazoEntrega={data.prazoEntrega}
      freteTipo={data.servicoFrete || data.freteTipo}
      modalidade={data.freteTipo || data.modalidade}
      observacoes={data.observacoes}
      empresa={data.empresaConfig || undefined}
    />
  );
}

/** Template PDF montado off-screen — usado por `buildPdfBlob` para html2canvas. */
export const OffscreenPdfTemplate = forwardRef<HTMLDivElement, { data: OrcamentoPdfData; layout: LayoutTemplate }>(
  function OffscreenPdfTemplate({ data, layout }, ref) {
    return (
      <div
        aria-hidden
        style={{ position: "fixed", left: -100000, top: 0, width: "210mm", pointerEvents: "none", opacity: 0 }}
      >
        <div ref={ref} className="bg-white" style={{ width: "210mm" }}>
          <OrcamentoPdfRender data={data} layout={layout} />
        </div>
      </div>
    );
  },
);

interface PreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  layout: LayoutTemplate;
  onLayoutChange: (l: LayoutTemplate) => void;
  zoom: number;
  onZoomChange: (z: number | ((prev: number) => number)) => void;
  autoScale: number;
  stageRef: RefObject<HTMLDivElement>;
  pdfRef: RefObject<HTMLDivElement>;
  data: OrcamentoPdfData;
  onDownloadPdf: () => void;
}

/** Diálogo de pré-visualização A4 (toolbar + zoom + stage) extraído de OrcamentoForm. */
export function PreviewDialog({
  open,
  onOpenChange,
  fullscreen,
  onToggleFullscreen,
  layout,
  onLayoutChange,
  zoom,
  onZoomChange,
  autoScale,
  stageRef,
  pdfRef,
  data,
  onDownloadPdf,
}: PreviewDialogProps) {
  const effectiveZoom = zoom || autoScale;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          // Reset total do dialog base (que é bottom-sheet em mobile)
          "p-0 gap-0 border bg-background overflow-hidden flex flex-col",
          "rounded-none sm:rounded-lg",
          fullscreen
            ? // Tela cheia real — viewport inteira em qualquer breakpoint
              "fixed inset-0 left-0 right-0 top-0 bottom-0 max-w-none w-screen h-[100dvh] max-h-[100dvh] sm:max-w-none sm:max-h-[100dvh] sm:left-0 sm:top-0 sm:translate-x-0 sm:translate-y-0 sm:rounded-none border-0"
            : // Janela — ocupa quase toda a tela em desktop, full em mobile
              "fixed inset-0 left-0 right-0 top-0 bottom-0 max-w-none w-screen h-[100dvh] max-h-[100dvh] sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[min(1280px,96vw)] sm:h-[min(960px,94vh)] sm:max-w-[1280px] sm:max-h-[94vh]",
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Pré-visualização do Orçamento</DialogTitle>
          <DialogDescription>Visualize como o orçamento será impresso ou enviado ao cliente.</DialogDescription>
        </DialogHeader>

        {/* Toolbar */}
        <div className="shrink-0 border-b bg-card">
          <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-3">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <h3 className="font-semibold text-xs sm:text-sm truncate">
                Pré-visualização — {(data.numero || "").replace(/^ORC/i, "ORC ")}
              </h3>
            </div>
            {/* Controles principais — sempre visíveis */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={onToggleFullscreen}
                aria-label={fullscreen ? "Sair de tela cheia" : "Expandir para tela cheia"}
                title={fullscreen ? "Sair de tela cheia" : "Tela cheia"}
              >
                {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
              <Button size="sm" variant="outline" onClick={() => onOpenChange(false)} className="h-9 hidden sm:inline-flex">
                Fechar
              </Button>
              <Button size="sm" onClick={onDownloadPdf} className="gap-1.5 h-9">
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Baixar PDF</span>
                <span className="sm:hidden">PDF</span>
              </Button>
            </div>
          </div>
          {/* Linha secundária — modelo + zoom */}
          <div className="flex items-center justify-between gap-2 px-3 pb-2 sm:px-4 sm:pb-3 flex-wrap">
            <Select value={layout} onValueChange={(v: LayoutTemplate) => onLayoutChange(v)}>
              <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="marca">Marca AviZee</SelectItem>
                <SelectItem value="classico">Clássico (laranja)</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-0.5 border rounded-md h-8 px-1 bg-background">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onZoomChange((z) => Math.max(0.3, (z || autoScale) - 0.1))} aria-label="Diminuir zoom">
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <button type="button" onClick={() => onZoomChange(0)} className="text-[11px] tabular-nums px-1.5 min-w-[44px] text-center hover:text-primary" title="Ajustar à tela">
                {Math.round(effectiveZoom * 100)}%
              </button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onZoomChange((z) => Math.min(2, (z || autoScale) + 0.1))} aria-label="Aumentar zoom">
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Stage A4 com auto-fit (largura + altura) */}
        <div ref={stageRef} className="flex-1 min-h-0 overflow-auto bg-muted/40 p-4">
          <div
            className="mx-auto"
            style={{
              width: `calc(210mm * ${effectiveZoom})`,
              height: `calc(297mm * ${effectiveZoom})`,
            }}
          >
            <div
              ref={pdfRef}
              className="bg-white shadow-2xl"
              style={{
                width: "210mm",
                height: "297mm",
                transform: `scale(${effectiveZoom})`,
                transformOrigin: "top left",
              }}
            >
              <OrcamentoPdfRender data={data} layout={layout} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}