import { toast } from "sonner";
import { CheckCircle2, FileText as FileTextIcon, Loader2, Mail, Send, UploadCloud } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import { getUserFriendlyError } from "@/utils/errorMessages";
import type { ClienteSnapshot } from "./types";

export type MailStep = "idle" | "pdf" | "upload" | "email" | "done";

interface EnviarEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mailStep: MailStep;
  setMailStep: (s: MailStep) => void;
  mailError: string | null;
  setMailError: (s: string | null) => void;
  emailTemplate: string;
  setEmailTemplate: (s: string) => void;
  clienteSnapshot: ClienteSnapshot;
  orcamentoId: string | null;
  numero: string;
  validade?: string;
  valorTotal: number;
  buildPdfBlob: () => Promise<Blob | null>;
}

/** Diálogo "Enviar por e-mail" extraído de OrcamentoForm — fases: compor → enviando → sucesso. */
export function EnviarEmailDialog({
  open,
  onOpenChange,
  mailStep,
  setMailStep,
  mailError,
  setMailError,
  emailTemplate,
  setEmailTemplate,
  clienteSnapshot,
  orcamentoId,
  numero,
  validade,
  valorTotal,
  buildPdfBlob,
}: EnviarEmailDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        // Não permitir fechar enquanto está enviando.
        if (!o && mailStep !== "idle" && mailStep !== "done") return;
        onOpenChange(o);
        if (!o) {
          setMailStep("idle");
          setMailError(null);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar orçamento por e-mail</DialogTitle>
          <DialogDescription>
            O cliente receberá um e-mail do <strong>Sistema ERP AviZee</strong> contendo o link público do orçamento, o PDF anexo (link válido por 30 dias) e a mensagem abaixo.
          </DialogDescription>
        </DialogHeader>

        {/* FASE 1 — Composição */}
        {mailStep === "idle" && (
          <>
            {clienteSnapshot.email ? (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Destinatário: </span>
                <span className="font-medium">{clienteSnapshot.nome_razao_social}</span>
                <span className="text-muted-foreground"> · {clienteSnapshot.email}</span>
              </div>
            ) : (
              <p className="text-sm text-destructive">Cliente não possui e-mail cadastrado.</p>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Mensagem ao cliente</Label>
              <Textarea value={emailTemplate} onChange={(e) => setEmailTemplate(e.target.value)} className="min-h-32" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button
                disabled={!clienteSnapshot.email}
                onClick={async () => {
                  if (!clienteSnapshot.email || !orcamentoId) return;
                  setMailError(null);
                  try {
                    setMailStep("pdf");
                    const pdfBlob = await buildPdfBlob();
                    setMailStep("upload");
                    // Pequena pausa visual para o usuário enxergar a etapa.
                    await new Promise((r) => setTimeout(r, 250));
                    setMailStep("email");
                    const { enviarOrcamentoPorEmail } = await import("@/services/orcamentos.service");
                    await enviarOrcamentoPorEmail(orcamentoId, clienteSnapshot.email, emailTemplate, {
                      numeroOrcamento: numero,
                      clienteNome: clienteSnapshot.nome_razao_social,
                      validade: validade ? formatDate(validade) : undefined,
                      valorTotal: formatCurrency(valorTotal),
                      pdfBlob: pdfBlob ?? undefined,
                    });
                    setMailStep("done");
                  } catch (err: unknown) {
                    const msg = getUserFriendlyError(err);
                    setMailError(msg);
                    setMailStep("idle");
                    toast.error(msg);
                  }
                }}
              >
                <Mail className="w-4 h-4 mr-2" /> Enviar e-mail
              </Button>
            </div>
          </>
        )}

        {/* FASE 2 — Enviando (stepper) */}
        {(mailStep === "pdf" || mailStep === "upload" || mailStep === "email") && (
          <div className="py-2 space-y-3">
            {[
              { key: "pdf" as const, label: "Gerando PDF do orçamento", icon: FileTextIcon },
              { key: "upload" as const, label: "Enviando PDF para armazenamento seguro", icon: UploadCloud },
              { key: "email" as const, label: "Despachando e-mail ao cliente", icon: Send },
            ].map(({ key, label, icon: Icon }) => {
              const order = { pdf: 0, upload: 1, email: 2 } as const;
              const current = order[mailStep as "pdf" | "upload" | "email"];
              const mine = order[key];
              const status: "done" | "current" | "pending" =
                mine < current ? "done" : mine === current ? "current" : "pending";
              return (
                <div key={key} className="flex items-center gap-3 text-sm">
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full border",
                      status === "done" && "border-primary bg-primary text-primary-foreground",
                      status === "current" && "border-primary text-primary",
                      status === "pending" && "border-muted-foreground/30 text-muted-foreground/60",
                    )}
                  >
                    {status === "done" ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : status === "current" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <span className={cn(status === "pending" && "text-muted-foreground")}>{label}</span>
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground pt-2">
              Aguarde — não feche esta janela até o envio concluir.
            </p>
          </div>
        )}

        {/* FASE 3 — Sucesso */}
        {mailStep === "done" && (
          <div className="py-4 space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium">E-mail enviado com sucesso!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Para <span className="font-medium">{clienteSnapshot.email}</span>
              </p>
            </div>
            <div className="flex justify-center">
              <Button onClick={() => { onOpenChange(false); setMailStep("idle"); }}>Fechar</Button>
            </div>
          </div>
        )}

        {mailError && mailStep === "idle" && (
          <p className="text-xs text-destructive">{mailError}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}