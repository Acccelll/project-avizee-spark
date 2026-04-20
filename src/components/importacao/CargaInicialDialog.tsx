import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Database, Loader2, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { useCargaInicial } from "@/hooks/importacao/useCargaInicial";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  onCompleted?: () => void;
}

export function CargaInicialDialog({ onCompleted }: Props) {
  const [open, setOpen] = useState(false);
  const [force, setForce] = useState(false);
  const { file, resumo, loteId, resultado, isProcessing, onFileChange, stageAll, consolidar } = useCargaInicial();

  const handleConsolidar = async () => {
    let id = loteId;
    if (!id) {
      id = await stageAll();
      if (!id) return;
    }
    const ok = await consolidar(force);
    if (ok) { onCompleted?.(); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)} className="gap-2" size="lg">
        <Database className="h-4 w-4" />
        Carga Inicial de Produção
      </Button>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> Carga Inicial de Produção</DialogTitle>
          <DialogDescription>
            Importação <strong>INSERT-ONLY</strong> da planilha de Conciliação. Bloqueia se houver dados pré-existentes nas tabelas alvo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Pré-requisitos</AlertTitle>
            <AlertDescription className="text-xs">
              Sistema deve estar zerado (use "Limpar Dados de Migração" antes). Esta carga não faz merge — falha em caso de conflito.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> Planilha Conciliação_FluxoCaixa</label>
            <Input type="file" accept=".xlsx,.xlsm" onChange={onFileChange} disabled={isProcessing} />
          </div>

          {resumo && (
            <div className="border rounded-lg p-4 bg-muted/30 space-y-2 text-xs">
              <div className="font-semibold text-sm">Abas detectadas: {resumo.abasDetectadas.join(", ")}</div>
              {resumo.abasFaltantes.length > 0 && (
                <div className="text-amber-700">Faltantes: {resumo.abasFaltantes.join(", ")}</div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-2">
                {Object.entries(resumo.contagens).map(([k, v]) => (
                  <div key={k} className="bg-background rounded p-2 border">
                    <div className="text-muted-foreground capitalize">{k}</div>
                    <div className="font-bold text-base">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {resultado && (
            <Alert className={resultado.erro ? "border-destructive" : "border-green-500"}>
              {resultado.erro
                ? <AlertTriangle className="h-4 w-4" />
                : <CheckCircle2 className="h-4 w-4" />}
              <AlertTitle>{resultado.erro ? "Bloqueado" : "Concluído"}</AlertTitle>
              <AlertDescription className="text-xs">
                <pre className="whitespace-pre-wrap">{JSON.stringify(resultado, null, 2)}</pre>
              </AlertDescription>
            </Alert>
          )}

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={force} onCheckedChange={(v) => setForce(v === true)} />
            Forçar carga mesmo com dados pré-existentes (não recomendado)
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isProcessing}>Fechar</Button>
          <Button onClick={handleConsolidar} disabled={!file || isProcessing} className="gap-2">
            {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
            {loteId ? "Confirmar Carga Inicial" : "Stage + Carga Inicial"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
