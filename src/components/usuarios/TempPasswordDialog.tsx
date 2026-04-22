/**
 * Diálogo dedicado para apresentar credenciais temporárias geradas pelo
 * `admin-users.create` quando o convite por e-mail não pôde ser entregue.
 *
 * Substitui o uso de `toast` (que vazaria em screencaptures e logs do
 * navegador) por uma UI explícita com botões de copiar e confirmação ativa
 * de leitura — alinhado ao princípio de não exibir segredos em superfícies
 * passivas.
 */
import { useEffect, useState } from "react";
import { Check, Copy, Eye, EyeOff, KeyRound, Link2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface TempPasswordDialogProps {
  open: boolean;
  onClose: () => void;
  userName: string;
  email: string;
  tempPassword: string;
  recoveryLink?: string | null;
}

export function TempPasswordDialog({
  open,
  onClose,
  userName,
  email,
  tempPassword,
  recoveryLink,
}: TempPasswordDialogProps) {
  const [reveal, setReveal] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState<"password" | "link" | null>(null);

  useEffect(() => {
    if (open) {
      setReveal(false);
      setAcknowledged(false);
      setCopied(null);
    }
  }, [open]);

  const handleCopy = async (kind: "password" | "link", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      toast.success(kind === "password" ? "Senha copiada." : "Link copiado.");
      // Auto-clear do clipboard depois de 60s para reduzir janela de exposição.
      setTimeout(() => {
        navigator.clipboard.writeText("").catch(() => undefined);
      }, 60_000);
    } catch {
      toast.error("Não foi possível copiar — copie manualmente.");
    }
  };

  const masked = "•".repeat(Math.max(8, tempPassword.length));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && acknowledged && onClose()}>
      <DialogContent className="sm:max-w-md" onEscapeKeyDown={(e) => !acknowledged && e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle>Credenciais temporárias</DialogTitle>
              <DialogDescription>
                O convite por e-mail não pôde ser entregue. Repasse manualmente
                ao usuário e oriente-o a redefinir no primeiro acesso.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="font-medium">{userName}</p>
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          </div>

          {/* Senha temporária */}
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" /> Senha temporária
            </Label>
            <div className="flex items-center gap-2">
              <code
                className={cn(
                  "flex-1 rounded-md border bg-background px-3 py-2 font-mono text-sm tracking-wider select-all",
                  !reveal && "text-muted-foreground",
                )}
              >
                {reveal ? tempPassword : masked}
              </code>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setReveal((v) => !v)}
                aria-label={reveal ? "Ocultar senha" : "Mostrar senha"}
              >
                {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleCopy("password", tempPassword)}
                aria-label="Copiar senha"
              >
                {copied === "password" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Link de redefinição */}
          {recoveryLink && (
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" /> Link de redefinição (opcional)
              </Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-md border bg-background px-3 py-2 font-mono text-xs">
                  {recoveryLink}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopy("link", recoveryLink)}
                  aria-label="Copiar link"
                >
                  {copied === "link" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Estas credenciais não serão exibidas novamente. O conteúdo da
              área de transferência será limpo após 60 segundos.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="ack-temp-password"
              checked={acknowledged}
              onCheckedChange={(v) => setAcknowledged(v === true)}
            />
            <Label htmlFor="ack-temp-password" className="text-sm cursor-pointer">
              Já anotei ou repassei as credenciais com segurança.
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} disabled={!acknowledged}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}