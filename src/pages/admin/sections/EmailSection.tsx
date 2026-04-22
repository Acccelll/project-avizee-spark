/**
 * EmailSection — parâmetros de identidade do remetente, reply-to e assinatura
 * institucional. Persiste em `app_configuracoes['email']`.
 */

import { useEffect, useState } from "react";
import { Calendar, Info, Mail, PenLine, Reply, Users } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { SectionShell } from "@/pages/admin/components/SectionShell";
import { useSectionConfig } from "@/pages/admin/hooks/useSectionConfig";

const DEFAULTS = {
  remetenteNome: "ERP AviZee",
  remetenteEmail: "contato@avizee.com.br",
  responderPara: "comercial@avizee.com.br",
  assinatura: "Equipe AviZee",
};

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export function EmailSection() {
  const { values, lastSaved, save, isSaving } = useSectionConfig("email", DEFAULTS);
  const [draft, setDraft] = useState(values);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraft(values);
  }, [values]);

  const update = <K extends keyof typeof DEFAULTS>(key: K, value: (typeof DEFAULTS)[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const handleSubmit = () => {
    const errs: Record<string, string> = {};
    if (!draft.remetenteNome.trim()) errs.remetenteNome = "Nome do remetente é obrigatório.";
    if (!draft.remetenteEmail.trim()) errs.remetenteEmail = "E-mail do remetente é obrigatório.";
    else if (!isValidEmail(draft.remetenteEmail)) errs.remetenteEmail = "Informe um e-mail válido.";
    if (draft.responderPara && !isValidEmail(draft.responderPara))
      errs.responderPara = "Informe um e-mail válido.";
    if (draft.assinatura.length > 1000)
      errs.assinatura = "A assinatura deve ter no máximo 1.000 caracteres.";
    if (Object.keys(errs).length) {
      setErrors(errs);
      toast.error("Corrija os campos obrigatórios antes de salvar.");
      return;
    }
    setErrors({});
    save(draft);
  };

  return (
    <SectionShell
      title="Parâmetros de comunicação"
      description="Identidade do remetente e assinatura institucional de e-mails."
      saveCta="Salvar parâmetros de e-mail"
      lastSavedAt={lastSaved.at}
      isSaving={isSaving}
      onSave={handleSubmit}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <Users className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <CardTitle>Identidade do remetente</CardTitle>
                <CardDescription>
                  Nome e endereço utilizados como origem dos e-mails comerciais e notificações automáticas do sistema.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>
                Nome do remetente <span className="text-destructive">*</span>
              </Label>
              <Input
                value={draft.remetenteNome}
                onChange={(e) => update("remetenteNome", e.target.value)}
                placeholder="ERP AviZee"
                className={cn(errors.remetenteNome ? "border-destructive focus-visible:ring-destructive" : "")}
              />
              {errors.remetenteNome ? (
                <p className="text-[11px] text-destructive">{errors.remetenteNome}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" />Nome exibido ao destinatário no campo "De:".
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>
                E-mail do remetente <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={draft.remetenteEmail}
                  onChange={(e) => update("remetenteEmail", e.target.value)}
                  placeholder="contato@empresa.com.br"
                  className={cn(
                    "pl-9",
                    errors.remetenteEmail ? "border-destructive focus-visible:ring-destructive" : "",
                  )}
                />
              </div>
              {errors.remetenteEmail ? (
                <p className="text-[11px] text-destructive">{errors.remetenteEmail}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" />Endereço configurado no serviço de envio do sistema.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <Reply className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <CardTitle>Resposta e roteamento</CardTitle>
                <CardDescription>
                  Define para onde as respostas dos destinatários serão encaminhadas quando eles responderem a um e-mail do sistema.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <Label>Responder para</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={draft.responderPara}
                  onChange={(e) => update("responderPara", e.target.value)}
                  placeholder="comercial@empresa.com.br"
                  className={cn(
                    "pl-9",
                    errors.responderPara ? "border-destructive focus-visible:ring-destructive" : "",
                  )}
                />
              </div>
              {errors.responderPara ? (
                <p className="text-[11px] text-destructive">{errors.responderPara}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" />Opcional. Se não preenchido, as respostas chegam ao próprio remetente.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <PenLine className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <CardTitle>Assinatura padrão</CardTitle>
                <CardDescription>
                  Texto inserido ao final de e-mails comerciais, orçamentos, pedidos e notificações automáticas.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Assinatura</Label>
              <Textarea
                value={draft.assinatura}
                onChange={(e) => update("assinatura", e.target.value)}
                rows={5}
                placeholder={"Equipe Comercial\ncontato@empresa.com.br\n(11) 99999-0000"}
                className={cn(errors.assinatura ? "border-destructive focus-visible:ring-destructive" : "")}
              />
              <div className="flex items-start justify-between gap-2">
                {errors.assinatura ? (
                  <p className="text-[11px] text-destructive">{errors.assinatura}</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" />Aplicada em e-mails comerciais e notificações automáticas.
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground shrink-0">
                  {draft.assinatura.length}/1000
                </p>
              </div>
            </div>
            {draft.assinatura && (
              <>
                <Separator />
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Pré-visualização
                  </p>
                  <div className="rounded-md border bg-muted/30 px-4 py-3">
                    <pre className="text-sm text-foreground font-sans whitespace-pre-wrap break-words">
                      {draft.assinatura}
                    </pre>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <CardTitle>Governança e uso no sistema</CardTitle>
                <CardDescription>
                  Rastreabilidade desta configuração e visibilidade do seu alcance nos fluxos do ERP.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border bg-muted/30 p-3 space-y-0.5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Última atualização
                </p>
                <p className="text-sm font-medium">
                  {lastSaved.at
                    ? new Date(lastSaved.at).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : "—"}
                </p>
              </div>
              <div className="rounded-md border bg-muted/30 p-3 space-y-0.5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Alterado por
                </p>
                <p className="text-sm font-medium">{lastSaved.by ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </SectionShell>
  );
}