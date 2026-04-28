import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { notifyError } from "@/utils/errorMessages";

/**
 * Drawer de alternância de Contingência SVC (Onda 6).
 *
 * - Ativa: grava `modo_emissao_nfe='contingencia_svc'` + motivo + início.
 * - Desativa: volta para `'normal'` (trigger limpa motivo/início).
 * Operação é tratada pelo trigger `trg_validar_contingencia_nfe` no banco.
 */

export interface ContingenciaSvcDrawerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  modoAtual: string | null;
  motivoAtual: string | null;
  onSalvo?: () => void;
}

export function ContingenciaSvcDrawer({
  open,
  onOpenChange,
  modoAtual,
  motivoAtual,
  onSalvo,
}: ContingenciaSvcDrawerProps) {
  const ativando = !modoAtual || modoAtual === "normal";
  const [motivo, setMotivo] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) setMotivo(ativando ? "" : (motivoAtual ?? ""));
  }, [open, ativando, motivoAtual]);

  const handleSubmit = async () => {
    if (ativando && motivo.trim().length < 15) {
      toast.error("Motivo deve ter no mínimo 15 caracteres.");
      return;
    }
    setPending(true);
    try {
      const patch = ativando
        ? {
            modo_emissao_nfe: "contingencia_svc",
            contingencia_motivo: motivo.trim(),
            contingencia_inicio: new Date().toISOString(),
          }
        : {
            modo_emissao_nfe: "normal",
            contingencia_motivo: null,
            contingencia_inicio: null,
          };
      const { data: row } = await supabase
        .from("empresa_config")
        .select("id")
        .limit(1)
        .maybeSingle();
      if (!row?.id) throw new Error("empresa_config não encontrada.");
      const { error } = await supabase
        .from("empresa_config")
        .update(patch)
        .eq("id", row.id);
      if (error) throw error;
      toast.success(ativando ? "Contingência SVC ativada." : "Emissão normal restabelecida.");
      onSalvo?.();
      onOpenChange(false);
    } catch (e) {
      notifyError(e);
    } finally {
      setPending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-warning" />
            {ativando ? "Ativar Contingência SVC" : "Sair da Contingência"}
          </SheetTitle>
          <SheetDescription>
            {ativando
              ? "Use somente quando a SEFAZ autorizadora estiver indisponível. As próximas NF-e serão transmitidas via SVC."
              : "Confirma o retorno à emissão normal pela SEFAZ autorizadora?"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {ativando ? (
            <>
              <Alert>
                <AlertDescription className="text-xs">
                  A contingência só deve ser ativada após confirmar a indisponibilidade
                  via consulta de status. O motivo ficará registrado para fins de auditoria.
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label htmlFor="motivo-contingencia">Motivo da contingência (≥15 caracteres)</Label>
                <Textarea
                  id="motivo-contingencia"
                  rows={4}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ex.: SEFAZ-SP indisponível desde 14h, cStat 109."
                />
                <p className="text-xs text-muted-foreground">{motivo.length} caracteres</p>
              </div>
            </>
          ) : (
            <Alert>
              <AlertDescription>
                Motivo registrado: <strong>{motivoAtual ?? "—"}</strong>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={pending}>
              {pending ? "Salvando…" : ativando ? "Ativar contingência" : "Voltar ao normal"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}