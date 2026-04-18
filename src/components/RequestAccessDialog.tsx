/**
 * `RequestAccessDialog` — diálogo simples para "Solicitar acesso" usado
 * dentro do `AccessDenied`. Pré-preenche um mailto com contexto da
 * permissão faltante para o administrador.
 */

import { useState } from "react";
import { Mail, Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const ADMIN_EMAIL = "admin@avizee.com.br";

export interface RequestAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceLabel?: string;
  permissionKey?: string;
}

export function RequestAccessDialog({
  open,
  onOpenChange,
  resourceLabel,
  permissionKey,
}: RequestAccessDialogProps) {
  const { profile, user } = useAuth();
  const [copied, setCopied] = useState(false);

  const subject = `Solicitação de acesso${resourceLabel ? ` — ${resourceLabel}` : ""}`;
  const body = [
    `Olá,`,
    ``,
    `Solicito acesso ao módulo "${resourceLabel ?? "—"}" do AviZee ERP.`,
    permissionKey ? `Permissão necessária: ${permissionKey}` : null,
    ``,
    `Usuário: ${profile?.nome ?? "—"}`,
    `E-mail: ${user?.email ?? "—"}`,
    ``,
    `Obrigado.`,
  ]
    .filter(Boolean)
    .join("\n");

  const mailto = `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(ADMIN_EMAIL);
      setCopied(true);
      toast.success("E-mail do administrador copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar — copie manualmente");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar acesso</DialogTitle>
          <DialogDescription>
            Envie uma solicitação ao administrador do sistema para liberar o acesso
            {resourceLabel ? ` ao módulo "${resourceLabel}"` : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Administrador</p>
              <p className="font-medium truncate">{ADMIN_EMAIL}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 shrink-0">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button asChild className="gap-2">
            <a href={mailto}>
              <Mail className="h-4 w-4" /> Abrir e-mail
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
