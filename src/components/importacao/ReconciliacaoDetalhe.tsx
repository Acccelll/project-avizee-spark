import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { ImportacaoLote } from "./ImportacaoLotesTable";
import { ImportacaoStatusBadge } from "./ImportacaoStatusBadge";
import { ImportacaoTimeline, ImportLog } from "./ImportacaoTimeline";
import { ReconciliacaoErrosTable } from "./ReconciliacaoErrosTable";
import { useSupabaseCrud } from "@/hooks/useSupabaseCrud";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatNumber } from "@/lib/format";
import { toast } from "sonner";

interface ReconciliacaoDetalheProps {
  lote: ImportacaoLote | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ReconciliacaoDetalhe({ lote, isOpen, onClose }: ReconciliacaoDetalheProps) {
  const logsCrud = useSupabaseCrud<ImportLog>({
    table: "importacao_logs",
    filter: lote ? [{ column: "lote_importacao_id", value: lote.id }] : [],
    orderBy: "criado_em",
    ascending: true,
    hasAtivo: false
  });

  if (!lote) return null;

  const handleExportErrors = () => {
    const errorLogs = logsCrud.data.filter(l => l.nivel === 'error');
    if (errorLogs.length === 0) {
      toast.info("Não há erros para exportar.");
      return;
    }

    const csvContent = [
      ["Etapa", "Mensagem", "Data"].join(","),
      ...errorLogs.map(l => [
        `"${l.etapa}"`,
        `"${l.mensagem.replace(/"/g, '""')}"`,
        `"${l.criado_em}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `erros_lote_${lote.id.slice(0, 8)}.csv`;
    link.click();
    toast.success("CSV exportado com sucesso.");
  };

  const metrics = [
    { label: "Lidos", value: lote.total_lidos, color: "text-blue-600" },
    { label: "Válidos", value: lote.total_validos, color: "text-emerald-600" },
    { label: "Com Erro", value: lote.total_erros, color: "text-rose-600" },
    { label: "Importados", value: lote.total_importados, color: "text-blue-700" },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-xl flex flex-col p-0">
        <ScrollArea className="flex-grow">
          <div className="p-6">
            <SheetHeader className="mb-6">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-xl">Conferência de Lote</SheetTitle>
                <ImportacaoStatusBadge status={lote.status} />
              </div>
              <SheetDescription className="font-mono text-[10px] uppercase">
                ID: {lote.id} | Arquivo: {lote.arquivo_nome}
              </SheetDescription>
            </SheetHeader>

            {/* Métricas do Lote */}
            <div className="grid grid-cols-4 gap-2 mb-8 bg-muted/30 p-4 rounded-lg border">
              {metrics.map((m, i) => (
                <div key={i} className="flex flex-col">
                  <span className="text-[10px] uppercase text-muted-foreground font-semibold">{m.label}</span>
                  <span className={`text-lg font-bold ${m.color}`}>{formatNumber(m.value)}</span>
                </div>
              ))}
            </div>

            <Tabs defaultValue="timeline" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 h-9">
                <TabsTrigger value="timeline" className="text-xs">Histórico</TabsTrigger>
                <TabsTrigger value="erros" className="text-xs">Inconsistências</TabsTrigger>
              </TabsList>

              <TabsContent value="timeline" className="mt-0 outline-none">
                <ImportacaoTimeline logs={logsCrud.data} />
              </TabsContent>

              <TabsContent value="erros" className="mt-0 outline-none">
                <ReconciliacaoErrosTable
                  erros={logsCrud.data
                    .filter(l => l.nivel === 'error')
                    .map((l, i) => ({
                      linha: i + 1,
                      mensagem: l.mensagem,
                      coluna: l.etapa
                    }))
                  }
                  onExport={handleExportErrors}
                />
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
