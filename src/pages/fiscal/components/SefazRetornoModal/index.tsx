import { Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface SefazRetornoModalProps {
  aberto: boolean;
  onFechar: () => void;
  protocolo?: string;
  status?: string;
  motivo?: string;
  xmlRetorno?: string;
  erros?: string[];
}

function getStatusBadge(status?: string) {
  if (!status) return <Badge variant="secondary">—</Badge>;
  if (status === "100") return <Badge className="bg-green-600">Autorizado ({status})</Badge>;
  if (status === "135" || status === "155")
    return <Badge className="bg-orange-500">Cancelado ({status})</Badge>;
  return <Badge variant="destructive">Rejeitado ({status})</Badge>;
}

function downloadXML(xml: string, nomeArquivo: string) {
  const blob = new Blob([xml], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

export function SefazRetornoModal({
  aberto,
  onFechar,
  protocolo,
  status,
  motivo,
  xmlRetorno,
  erros,
}: SefazRetornoModalProps) {
  return (
    <Dialog open={aberto} onOpenChange={(open) => !open && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Retorno da SEFAZ</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Status:</span>
            {getStatusBadge(status)}
          </div>

          {protocolo && (
            <div>
              <p className="text-sm font-medium">Protocolo</p>
              <p className="font-mono text-sm text-muted-foreground">{protocolo}</p>
            </div>
          )}

          {motivo && (
            <div>
              <p className="text-sm font-medium">Motivo</p>
              <p className="text-sm text-muted-foreground">{motivo}</p>
            </div>
          )}

          {erros && erros.length > 0 && (
            <div>
              <p className="text-sm font-medium text-destructive">Erros</p>
              <ul className="mt-1 space-y-1">
                {erros.map((e, i) => (
                  <li key={i} className="text-sm text-destructive">
                    • {e}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {xmlRetorno && (
            <div>
              <p className="mb-1 text-sm font-medium">XML de Retorno</p>
              <ScrollArea className="h-32 rounded-md border">
                <pre className="p-2 font-mono text-xs">{xmlRetorno}</pre>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {xmlRetorno && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadXML(xmlRetorno, `retorno-sefaz-${protocolo ?? "xml"}.xml`)}
            >
              <Download className="mr-2 h-4 w-4" />
              Baixar XML
            </Button>
          )}
          <Button onClick={onFechar}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
